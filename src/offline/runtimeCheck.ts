import { analyzeDecision } from '../lab/analysisClient';
import type { DecisionAnalysis, DecisionSnapshot } from '../lab/analysis';

// Exercise the actual bundled calculation worker before declaring this device
// ready. A royal-flush board is an exact tie, independent of sampled ranges.
const probe = (): DecisionSnapshot => ({
  decisionId: 'offline-runtime-check-v1', seed: 80421,
  hero: ['2c', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
  players: Array.from({ length: 6 }, (_, seatIndex) => ({
    seatIndex, folded: seatIndex > 1, totalCommitted: 0, streetBet: 0, stack: 1000,
  })),
  heroSeat: 0, currentBet: 0, lastRaiseAmount: 10, bb: 10,
  position: 'BTN', phase: 'river', legal: { seatIndex: 0, check: true, fold: true },
  preset: 'standard', iterations: 1000,
});

export async function verifyCalculationRuntime(
  calculate: (snapshot: DecisionSnapshot) => Promise<DecisionAnalysis> = analyzeDecision,
): Promise<void> {
  const snapshot = probe();
  const result = await calculate(snapshot);
  if (result.decisionId !== snapshot.decisionId || result.status !== 'ok' || result.samples !== 1000 ||
      Math.abs(result.equity - 0.5) > 1e-12 || result.win !== 0 || result.tie !== 1) {
    throw new Error('此设备的本地计算未通过检查。请在 Safari 中重新打开，联网后重试。');
  }
}

let verified: Promise<void> | undefined;
export function checkOfflineRuntime(): Promise<void> {
  if (!verified) verified = verifyCalculationRuntime().catch((error: unknown) => {
    verified = undefined;
    throw error;
  });
  return verified;
}
