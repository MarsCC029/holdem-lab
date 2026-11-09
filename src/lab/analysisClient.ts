import { failedAnalysis } from './analysis';
import type { DecisionAnalysis, DecisionSnapshot } from './analysis';
let worker: Worker | null = null;
let nextRequestId = 1;
interface Pending { decisionId: string; timer: ReturnType<typeof setTimeout>; resolve: (result: DecisionAnalysis) => void }
const pending = new Map<number, Pending>();
function stopWorker(message: string): void {
  worker?.terminate(); worker = null;
  for (const job of pending.values()) { clearTimeout(job.timer); job.resolve(failedAnalysis(job.decisionId, message)); }
  pending.clear();
}
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ requestId: number; decisionId: string; result: DecisionAnalysis }>) => {
      const { requestId, decisionId, result } = event.data;
      const job = pending.get(requestId);
      if (!job) return;
      pending.delete(requestId); clearTimeout(job.timer);
      job.resolve(decisionId === job.decisionId && result?.decisionId === job.decisionId ? result
        : failedAnalysis(job.decisionId, '已忽略过期的分析结果。'));
    };
    worker.onerror = () => stopWorker('计算进程出错，请重试。');
    worker.onmessageerror = () => stopWorker('分析数据无法读取，请重试。');
  }
  return worker;
}
/** Always off the UI thread. Caller also verifies decisionId before displaying a result. */
export function analyzeDecision(snapshot: DecisionSnapshot): Promise<DecisionAnalysis> {
  const requestId = nextRequestId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => stopWorker('计算超时，请重试或减少对手。'), 15_000);
    pending.set(requestId, { decisionId: snapshot.decisionId, timer, resolve });
    try { getWorker().postMessage({ requestId, decisionId: snapshot.decisionId, snapshot }); }
    catch { stopWorker('此浏览器暂时无法启动离线分析。'); }
  });
}
export function cancelPendingAnalysis(): void { stopWorker('分析已取消。'); }
