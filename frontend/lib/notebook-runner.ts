export type NotebookOutput = { stdout: string; result: unknown };
type Pending = { resolve: (value: NotebookOutput) => void; reject: (error: Error) => void; timer: number };
let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<string, Pending>();

function getWorker() {
  if (worker) return worker;
  const source = `
    let pyodidePromise;
    async function getPyodide() {
      if (!pyodidePromise) pyodidePromise = import('https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.mjs').then(({ loadPyodide }) => loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.2/full/' }));
      return pyodidePromise;
    }
    self.onmessage = async ({ data }) => {
      const { id, code } = data;
      try {
        const pyodide = await getPyodide();
        await pyodide.loadPackage(['numpy', 'pandas']);
        pyodide.globals.set('__notebook_code', code);
        const output = await pyodide.runPythonAsync("import contextlib, io, json\\nif '__notebook_scope' not in globals(): __notebook_scope = {}\\n__notebook_scope.pop('result', None)\\n__stdout = io.StringIO()\\nwith contextlib.redirect_stdout(__stdout):\\n    exec(__notebook_code, __notebook_scope)\\n__result = __notebook_scope.get('result', None)\\ndef __json_default(value):\\n    if hasattr(value, 'to_dict'): return value.to_dict(orient='records')\\n    if hasattr(value, 'tolist'): return value.tolist()\\n    return str(value)\\njson.dumps({'stdout': __stdout.getvalue(), 'result': __result}, default=__json_default)");
        self.postMessage({ id, output: output.toString() });
      } catch (error) { self.postMessage({ id, error: String(error) }); }
    };
  `;
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  worker = new Worker(url);
  URL.revokeObjectURL(url);
  worker.onmessage = (event: MessageEvent<{ id: string; output?: string; error?: string }>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    window.clearTimeout(request.timer);
    pending.delete(event.data.id);
    if (event.data.error) { request.reject(new Error(event.data.error)); return; }
    try { request.resolve(JSON.parse(event.data.output ?? "{}") as NotebookOutput); }
    catch (error) { request.reject(error instanceof Error ? error : new Error("Could not parse notebook output.")); }
  };
  worker.onerror = (event) => {
    for (const [id, request] of pending) {
      window.clearTimeout(request.timer);
      request.reject(new Error(event.message || "Notebook execution failed."));
      pending.delete(id);
    }
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function runNotebookCode(code: string, timeoutMs = 5_000): Promise<NotebookOutput> {
  return new Promise((resolve, reject) => {
    const id = String(++sequence);
    const timer = window.setTimeout(() => {
      pending.delete(id);
      worker?.terminate();
      worker = null;
      reject(new Error("Execution stopped after 5 seconds. Check for an infinite loop and try again."));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    getWorker().postMessage({ id, code });
  });
}
