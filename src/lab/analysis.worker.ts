import { computeDecisionAnalysis, failedAnalysis } from './analysis';
import type { DecisionSnapshot } from './analysis';
self.onmessage = (event: MessageEvent<{ requestId: number; decisionId: string; snapshot: DecisionSnapshot }>) => {
  const { requestId, decisionId, snapshot } = event.data;
  try {
    const result = snapshot?.decisionId === decisionId ? computeDecisionAnalysis(snapshot)
      : failedAnalysis(decisionId, '分析请求与行动编号不匹配。');
    self.postMessage({ requestId, decisionId, result });
  } catch {
    self.postMessage({ requestId, decisionId, result: failedAnalysis(decisionId, '计算进程出错，请重试。') });
  }
};
