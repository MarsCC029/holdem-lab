import { describe, expect, it } from 'vitest';
import { verifyCalculationRuntime } from './runtimeCheck';
import { computeDecisionAnalysis } from '../lab/analysis';

describe('device readiness calculation probe', () => {
  it('accepts the exact royal-board tie through the real analysis implementation', async () => {
    await expect(verifyCalculationRuntime(async (snapshot) => computeDecisionAnalysis(snapshot))).resolves.toBeUndefined();
  });
  it('does not label a failing or mismatched computation ready', async () => {
    for (const change of [{ status: 'invalid-input' as const }, { decisionId: 'old-job' }, { equity: 1 }, { samples: 0 }]) {
      await expect(verifyCalculationRuntime(async (snapshot) => ({ ...computeDecisionAnalysis(snapshot), ...change })))
        .rejects.toThrow('本地计算未通过检查');
    }
  });
  it('propagates worker startup failure so readiness stays false', async () => {
    await expect(verifyCalculationRuntime(async () => { throw new Error('Worker unavailable'); })).rejects.toThrow('Worker unavailable');
  });
});
