export type ChallengeTest = { input: unknown[]; expected: unknown };
export type ChallengeLanguage = "javascript" | "python";
export type ChallengeRunResult = { passed: number; total: number; results: boolean[]; outputs: string[] };
type WorkerReply = { id: string; results?: { pass: boolean; output: string }[]; error?: string };
type PendingRun = { resolve: (value: ChallengeRunResult) => void; reject: (error: Error) => void; timer: number };

const workers = new Map<ChallengeLanguage, Worker>();
const pending = new Map<string, PendingRun>();
let nextId = 0;

function workerFor(language: ChallengeLanguage) {
  const existing = workers.get(language);
  if (existing) return existing;
  const source = language === "javascript" ? `
    self.onmessage = ({ data }) => {
      const { id, code, tests } = data;
      const send = self.postMessage.bind(self);
      try {
        send({ id, phase: 'ready' });
        for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']) { try { Object.defineProperty(self, key, { value: undefined, configurable: false, writable: false }); } catch {} }
        try { Object.defineProperty(self, 'postMessage', { value: () => {}, configurable: false, writable: false }); Object.defineProperty(self, 'close', { value: () => {}, configurable: false, writable: false }); } catch {}
        const canonical = (value) => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
        const fn = new Function('args', '"use strict"; const solution = (' + code + '); return solution(...args);');
        const results = tests.map((test) => {
          try { const result = fn(test.input); return { pass: canonical(result) === canonical(test.expected), output: JSON.stringify(result) }; }
          catch (error) { return { pass: false, output: String(error) }; }
        });
        send({ id, results });
      } catch (error) { send({ id, error: String(error) }); }
    };
  ` : `
    let pyodidePromise;
    async function getPyodide() {
      if (!pyodidePromise) pyodidePromise = import('https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.mjs').then(({ loadPyodide }) => loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.2/full/' }));
      return pyodidePromise;
    }
    self.onmessage = async ({ data }) => {
      const { id, code, tests, packages } = data;
      const send = self.postMessage.bind(self);
      try {
        const pyodide = await getPyodide();
        if (packages) await pyodide.loadPackage(['numpy', 'pandas']);
        send({ id, phase: 'ready' });
        for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts']) { try { Object.defineProperty(self, key, { value: undefined, configurable: false, writable: false }); } catch {} }
        try { Object.defineProperty(self, 'postMessage', { value: () => {}, configurable: false, writable: false }); Object.defineProperty(self, 'close', { value: () => {}, configurable: false, writable: false }); } catch {}
        const canonical = (value) => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
        const results = [];
        for (const test of tests) {
          pyodide.globals.set('__challenge_code', code);
          pyodide.globals.set('__challenge_input', JSON.stringify(test.input));
          const output = await pyodide.runPythonAsync("import json\\ndef __json_default(value):\\n    if hasattr(value, 'to_dict'): return value.to_dict(orient='records')\\n    if hasattr(value, 'tolist'): return value.tolist()\\n    return str(value)\\nnamespace = {}\\nexec(__challenge_code, namespace)\\njson.dumps(namespace['solution'](*json.loads(__challenge_input)), default=__json_default)");
          const actual = JSON.parse(output.toString());
          results.push({ pass: canonical(actual) === canonical(test.expected), output: JSON.stringify(actual) });
        }
        send({ id, results });
      } catch (error) { send({ id, error: String(error) }); }
    };
  `;
  const blob = new Blob([source], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  const worker = new Worker(blobUrl);
  URL.revokeObjectURL(blobUrl);
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    if ((event.data as WorkerReply & { phase?: string }).phase === "ready") {
      window.clearTimeout(request.timer);
      request.timer = window.setTimeout(() => {
        pending.delete(event.data.id);
        worker.terminate();
        workers.delete(language);
        request.reject(new Error("Execution stopped after 5 seconds. Check for an infinite loop and try again."));
      }, 5_000);
      return;
    }
    window.clearTimeout(request.timer);
    pending.delete(event.data.id);
    if (event.data.error) { request.reject(new Error(event.data.error)); return; }
    const results = event.data.results ?? [];
    request.resolve({ passed: results.filter((result) => result.pass).length, total: results.length, results: results.map((result) => result.pass), outputs: results.map((result) => result.output) });
  };
  worker.onerror = (event) => {
    for (const [id, request] of pending) {
      window.clearTimeout(request.timer);
      request.reject(new Error(event.message || "Code execution failed."));
      pending.delete(id);
    }
    worker.terminate();
    workers.delete(language);
  };
  workers.set(language, worker);
  return worker;
}

/** Runs in a disposable Web Worker; killing the worker enforces a hard wall-clock timeout. */
export function runChallengeCode(language: ChallengeLanguage, code: string, tests: ChallengeTest[], options: { timeoutMs?: number; loadDataPackages?: boolean } = {}): Promise<ChallengeRunResult> {
  return new Promise((resolve, reject) => {
    const worker = workerFor(language);
    const id = String(++nextId);
    const timeoutMs = options.timeoutMs ?? 5_000;
    const timer = window.setTimeout(() => {
      pending.delete(id);
      worker.terminate();
      workers.delete(language);
      reject(new Error("Execution stopped after 5 seconds. Check for an infinite loop and try again."));
    }, language === "python" ? 90_000 : timeoutMs);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, code, tests, packages: options.loadDataPackages ?? false });
  });
}
