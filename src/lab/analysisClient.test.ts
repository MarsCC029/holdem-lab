import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeDecision, cancelPendingAnalysis } from './analysisClient';
import { failedAnalysis } from './analysis';
import type { DecisionSnapshot } from './analysis';

class MockWorker {
  static current: MockWorker;
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  sent: { requestId: number; decisionId: string; snapshot: DecisionSnapshot }[] = [];
  terminated = false;
  constructor() { MockWorker.current = this; }
  postMessage(message: MockWorker['sent'][number]) { this.sent.push(message); }
  terminate() { this.terminated = true; }
}
const snapshot = { decisionId: 'h:1' } as DecisionSnapshot;
afterEach(() => { cancelPendingAnalysis(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('analysis Worker request isolation', () => {
  it('matches both request and decision ids, rejecting stale results', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const promise = analyzeDecision(snapshot);
    const worker = MockWorker.current;
    const request = worker.sent[0];
    worker.onmessage?.({ data: { requestId: request.requestId, decisionId: 'old', result: failedAnalysis('old', 'x') } } as MessageEvent);
    expect((await promise).error).toContain('过期');
  });
  it('resolves all pending requests on a Worker crash', async () => {
    vi.stubGlobal('Worker', MockWorker);
    const a = analyzeDecision(snapshot); const b = analyzeDecision({ ...snapshot, decisionId: 'h:2' });
    MockWorker.current.onerror?.();
    expect((await a).status).toBe('invalid-input'); expect((await b).decisionId).toBe('h:2');
    expect(MockWorker.current.terminated).toBe(true);
  });
  it('times out rather than leaving the UI waiting forever', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', MockWorker);
    const promise = analyzeDecision(snapshot);
    vi.advanceTimersByTime(15_000);
    expect((await promise).error).toContain('超时');
  });
});
