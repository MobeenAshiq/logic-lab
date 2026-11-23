export type SnippetOutput = { stdout: string; error?: string };

/**
 * Runs a lesson's JavaScript example in a throwaway Web Worker (no page, cookies
 * or network access) and returns what it printed with console.log.
 */
export function runJavaScriptSnippet(code: string, timeoutMs = 3000): Promise<SnippetOutput> {
  const source = `
    for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']) { try { Object.defineProperty(self, key, { value: undefined }); } catch {} }
    self.onmessage = async ({ data }) => {
      const lines = [];
      const show = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
      const log = (...args) => lines.push(args.map(show).join(' '));
      self.console = { log, info: log, warn: log, error: log, table: log };
      try {
        await (0, eval)('(async () => {\\n' + data + '\\n})()');
        self.postMessage({ stdout: lines.join('\\n') });
      } catch (error) {
        self.postMessage({ stdout: lines.join('\\n'), error: String(error) });
      }
    };
  `;
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return new Promise((resolve) => {
    // Endless loops: stop the worker instead of freezing the tab.
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve({ stdout: "", error: `Stopped after ${timeoutMs / 1000}s (endless loop?)` });
    }, timeoutMs);
    worker.onmessage = ({ data }) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(data as SnippetOutput);
    };
    worker.postMessage(code);
  });
}
