import { api, putToStorage } from "@/lib/api/client";
import type { UploadTicket } from "@/types/api";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Two-step upload: ask the API for a presigned URL (it validates type and size),
 * then PUT the file straight to R2. Returns the storage key to save.
 */
export async function uploadFile(
  endpoint: string,
  file: File,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const ticket = await api<UploadTicket>(endpoint, {
    method: "POST",
    body: { ...extra, contentType: file.type, size: file.size },
  });
  await putToStorage(ticket, file);
  return ticket.key;
}
