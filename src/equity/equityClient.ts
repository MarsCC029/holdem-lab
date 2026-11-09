import type { EquityOptions, EquityResult } from './monteCarlo';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: EquityResult) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ requestId: number; result: EquityResult }>) => {
      const { requestId, result } = e.data;
      pending.get(requestId)?.(result);
      pending.delete(requestId);
    };
  }
  return worker;
}

/** Runs a Monte Carlo equity simulation off the main thread. */
export function getEquity(opts: EquityOptions): Promise<EquityResult> {
  const requestId = nextId++;
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    getWorker().postMessage({ requestId, opts });
  });
}
