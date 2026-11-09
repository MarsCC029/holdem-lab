import { monteCarloEquity, type EquityOptions } from './monteCarlo';

interface EquityRequest {
  requestId: number;
  opts: EquityOptions;
}

self.onmessage = (e: MessageEvent<EquityRequest>) => {
  const { requestId, opts } = e.data;
  const result = monteCarloEquity(opts);
  self.postMessage({ requestId, result });
};
