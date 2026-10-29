import { Worker } from 'node:worker_threads';

const RUNNER = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  try {
    const { getQuickJS } = require('quickjs-emscripten');
    const quickjs = await getQuickJS();
    parentPort.postMessage({ ok: true, phase: 'ready' });
    const results = [];
    for (const test of workerData.tests) {
      const runtime = quickjs.newRuntime();
      runtime.setMemoryLimit(32 * 1024 * 1024);
      const context = runtime.newContext();
      try {
        context.setProp(context.global, '__code', context.newString(workerData.code));
        context.setProp(context.global, '__input', context.newString(JSON.stringify(test.input)));
        const result = context.evalCode("(() => { const solution = eval('(' + __code + ')'); return JSON.stringify(solution(...JSON.parse(__input))); })()");
        if (result.error) { result.error.dispose(); results.push(false); }
        else {
          const output = context.dump(result.value);
          result.value.dispose();
          try { results.push(JSON.stringify(JSON.parse(output)) === JSON.stringify(test.expected)); }
          catch { results.push(false); }
        }
      } finally { context.dispose(); runtime.dispose(); }
    }
    parentPort.postMessage({ ok: true, results });
  } catch (error) { parentPort.postMessage({ ok: false, error: String(error) }); }
})();
`;

export function runJavaScriptHiddenTests(
  code: string,
  tests: { input: unknown[]; expected: unknown }[],
  timeoutMs = 5_000,
): Promise<boolean[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(RUNNER, {
      eval: true,
      workerData: { code, tests },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
    });
    let settled = false;
    let timeout = setTimeout(() => {
      settled = true;
      void worker.terminate();
      reject(new Error('JavaScript hidden tests timed out.'));
    }, 90_000);
    worker.on('message', (message: { ok: boolean; phase?: string; results?: boolean[]; error?: string }) => {
      if (settled) return;
      if (message.phase === 'ready') {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          settled = true;
          void worker.terminate();
          reject(new Error('JavaScript hidden tests timed out.'));
        }, timeoutMs);
        return;
      }
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (message.ok) resolve(message.results ?? []);
      else reject(new Error(message.error ?? 'JavaScript hidden tests failed.'));
    });
    worker.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    worker.once('exit', (code) => {
      clearTimeout(timeout);
      if (!settled && code !== 0) reject(new Error(`JavaScript runner exited with code ${code}.`));
    });
  });
}
