const SOURCE = `
self.onmessage = async ({ data }) => {
  const send = self.postMessage.bind(self);
  const lines = [];
  const fmt = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v, null, 2); } catch { return String(v); } })();
  const log = (...args) => lines.push(args.map(fmt).join(' '));
  for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']) {
    try { Object.defineProperty(self, key, { value: undefined, configurable: false, writable: false }); } catch {}
  }
  const console = { log, info: log, warn: log, debug: log, table: log, error: (...a) => log('Error:', ...a) };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const result = await new AsyncFunction('console', '"use strict";\\n' + data.code)(console);
    if (result !== undefined) lines.push(fmt(result));
    send({ ok: true, output: lines.join('\\n') });
  } catch (error) {
    send({ ok: false, output: lines.concat(String(error)).join('\\n') });
  }
};`;

/**
 * Runs a JavaScript snippet in a throwaway Web Worker (no DOM, no network),
 * capturing console output. Killed after `timeoutMs`.
 */
export function runJavaScript(code: string, timeoutMs = 5000): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, output: `Stopped after ${timeoutMs / 1000} seconds. Check for an infinite loop.` });
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent<{ ok: boolean; output: string }>) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, output: event.message || "The code could not run." });
    };
    worker.postMessage({ code });
  });
}
