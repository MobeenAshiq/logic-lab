import { api, ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { TeachLesson } from "@/types/api";

export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const MAX_VIDEO_BYTES = 2000 * 1024 * 1024;
const CONCURRENCY = 3;
const URL_BATCH = 9;
const RETRIES = 3;

interface StartResponse {
  key: string;
  uploadId: string;
  partSize: number;
  partCount: number;
}

/** Duration in whole seconds, read from the file's metadata in the browser. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve(Math.max(1, Math.round(Number.isFinite(seconds) ? seconds : 1)));
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(1);
    video.src = url;
  });
}

function putPart(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(`Part upload failed (${xhr.status})`));
      }
      const etag = xhr.getResponseHeader("ETag");
      if (!etag)
        return reject(
          new ApiError(0, {
            statusCode: 0,
            code: "ETAG_MISSING",
            message: t.learning.media.etagMissing,
          }),
        );
      resolve(etag);
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/**
 * Uploads a lecture video straight to R2 in 10 MB parts (3 at a time, each
 * retried), asking the API for part URLs in small batches so none expire.
 * Calls onProgress with 0..1. Abort with `signal`.
 */
export async function uploadLessonVideo(
  lessonId: string,
  file: File,
  { onProgress, signal }: { onProgress: (fraction: number) => void; signal: AbortSignal },
): Promise<TeachLesson> {
  const base = `/teach/lessons/${lessonId}/video`;
  const durationSeconds = await readVideoDuration(file);
  const start = await api<StartResponse>(`${base}/start`, {
    method: "POST",
    body: { contentType: file.type, size: file.size },
  });

  const urls = new Map<number, string>();
  const loaded = new Map<number, number>();
  const report = () => onProgress([...loaded.values()].reduce((a, b) => a + b, 0) / file.size);

  async function urlFor(partNumber: number) {
    if (!urls.has(partNumber)) {
      const partNumbers = Array.from(
        { length: Math.min(URL_BATCH, start.partCount - partNumber + 1) },
        (_, i) => partNumber + i,
      );
      const res = await api<{ urls: { partNumber: number; url: string }[] }>(`${base}/parts`, {
        method: "POST",
        body: { key: start.key, uploadId: start.uploadId, partNumbers },
      });
      for (const u of res.urls) urls.set(u.partNumber, u.url);
    }
    return urls.get(partNumber)!;
  }

  async function uploadPart(partNumber: number) {
    const from = (partNumber - 1) * start.partSize;
    const blob = file.slice(from, Math.min(from + start.partSize, file.size));
    for (let attempt = 1; ; attempt++) {
      try {
        const etag = await putPart(
          await urlFor(partNumber),
          blob,
          (n) => {
            loaded.set(partNumber, n);
            report();
          },
          signal,
        );
        loaded.set(partNumber, blob.size);
        report();
        return { partNumber, etag };
      } catch (err) {
        const fatal = signal.aborted || (err instanceof ApiError && err.code === "ETAG_MISSING");
        if (fatal || attempt >= RETRIES) throw err;
        urls.delete(partNumber); // the URL may have expired
        loaded.set(partNumber, 0);
      }
    }
  }

  try {
    const queue = Array.from({ length: start.partCount }, (_, i) => i + 1);
    const parts: { partNumber: number; etag: string }[] = [];
    const worker = async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        parts.push(await uploadPart(next));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, start.partCount) }, worker));
    return await api<TeachLesson>(`${base}/complete`, {
      method: "POST",
      body: { key: start.key, uploadId: start.uploadId, parts, durationSeconds },
    });
  } catch (err) {
    // Free the partial upload on R2; the original error is what matters.
    await api(`${base}/abort`, {
      method: "POST",
      body: { key: start.key, uploadId: start.uploadId },
    }).catch(() => {});
    throw err;
  }
}

/** Browsers often report "" for code files; the API needs a known content type. */
const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  json: "application/json",
  ipynb: "application/x-ipynb+json",
  py: "text/x-python",
  js: "text/javascript",
  html: "text/html",
  css: "text/css",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function attachmentContentType(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ATTACHMENT_TYPES[ext] ?? null;
}

export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((e) => `.${e}`)
  .join(",");
