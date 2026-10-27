/**
 * Reads the text on a payment slip image in the browser (Tesseract.js, loaded on
 * demand). The text goes to the admin, who sees whether the amount and
 * transaction ID appear on the slip. PDFs are not read.
 */
export async function readSlipText(file: File, onProgress?: (fraction: number) => void) {
  if (!file.type.startsWith("image/")) return null;
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text.slice(0, 20_000);
  } finally {
    await worker.terminate();
  }
}
