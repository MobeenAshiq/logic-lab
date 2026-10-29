import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(__filename);
const PYODIDE_MODULE_URL = pathToFileURL(require.resolve('pyodide')).href;
const RUNNER = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  try {
    const { loadPyodide } = await import(workerData.pyodideModuleUrl);
    const pyodide = await loadPyodide();
    await pyodide.loadPackage(['numpy', 'pandas']);
    pyodide.globals.set('__student_code', workerData.code);
    pyodide.globals.set('__tests_json', JSON.stringify(workerData.tests));
    const result = await pyodide.runPythonAsync("import json\\n__tests = json.loads(__tests_json)\\n__namespace = {}\\nexec(__student_code, __namespace)\\n__results = []\\nfor __test in __tests:\\n    try:\\n        __actual = __namespace['solution'](*__test['input'])\\n        __results.append(json.dumps(__actual, sort_keys=True) == json.dumps(__test['expected'], sort_keys=True))\\n    except BaseException:\\n        __results.append(False)\\njson.dumps(__results)");
    parentPort.postMessage({ ok: true, results: JSON.parse(result.toString()) });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: String(error) });
  }
})();
`;

export function runPythonHiddenTests(
  code: string,
  tests: { input: unknown[]; expected: unknown }[],
  timeoutMs = 5_000,
): Promise<boolean[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(RUNNER, {
      eval: true,
      workerData: { code, tests, pyodideModuleUrl: PYODIDE_MODULE_URL },
    });
    const timeout = setTimeout(() => {
      void worker.terminate();
      reject(new Error('Python hidden test timed out.'));
    }, timeoutMs);
    worker.once('message', (message: { ok: boolean; results?: boolean[]; error?: string }) => {
      clearTimeout(timeout);
      void worker.terminate();
      if (message.ok) resolve(message.results ?? []);
      else reject(new Error(message.error ?? 'Python hidden test failed.'));
    });
    worker.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    worker.once('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`Python runner exited with code ${code}.`));
    });
  });
}
