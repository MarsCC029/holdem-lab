import { checkOfflineRuntime } from './runtimeCheck';

export interface OfflineStatus {
  ready: boolean;
  updateAvailable: boolean;
  error?: string;
}

export interface OfflineController {
  /** Call only after the user accepts the update between hands. */
  acceptUpdate(): Promise<void>;
  refresh(): Promise<void>;
  dispose(): void;
}

type WorkerStatus = { type: 'OFFLINE_STATUS'; ready: boolean; version: string; error?: string };

function queryWorker(worker: ServiceWorker): Promise<WorkerStatus> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('离线资源检查超时，请联网后重试。'));
    }, 30_000);
    channel.port1.onmessage = (event: MessageEvent<WorkerStatus>) => {
      window.clearTimeout(timer);
      channel.port1.close();
      if (event.data?.type !== 'OFFLINE_STATUS') {
        reject(new Error('离线资源状态无法确认。'));
        return;
      }
      resolve(event.data);
    };
    worker.postMessage({ type: 'VERIFY_OFFLINE', repair: navigator.onLine }, [channel.port2]);
  });
}

/** Register local-only offline support. Readiness requires a controlled page and verified cache. */
export async function startOffline(onStatus: (status: OfflineStatus) => void): Promise<OfflineController> {
  let disposed = false;
  let accepting = false;
  let registration: ServiceWorkerRegistration | undefined;
  let checking = false;
  let rerun = false;
  let status: OfflineStatus = { ready: false, updateAvailable: false };
  const publish = (next: OfflineStatus) => {
    status = next;
    if (!disposed) onStatus(next);
  };
  const observedWorkers = new Set<ServiceWorker>();
  const refresh = async (): Promise<void> => {
    if (disposed) return;
    if (checking) { rerun = true; return; }
    checking = true;
    try {
      if (navigator.onLine && registration && !registration.installing) void registration.update().catch(() => undefined);
      const worker = navigator.serviceWorker?.controller;
      const updateAvailable = Boolean(registration?.waiting);
      if (!worker) {
        publish({ ready: false, updateAvailable });
        return;
      }
      const result = await queryWorker(worker);
      if (result.ready) await checkOfflineRuntime();
      publish({ ready: result.ready, updateAvailable, ...(!result.ready ? { error: result.error ?? '离线资源不完整，请联网后重新加载。' } : {}) });
    } catch (error) {
      publish({ ready: false, updateAvailable: Boolean(registration?.waiting), error: error instanceof Error ? error.message : '无法确认离线缓存。' });
    } finally {
      checking = false;
      if (rerun) { rerun = false; void refresh(); }
    }
  };
  const onControllerChange = () => {
    if (accepting) { window.location.reload(); return; }
    void refresh();
  };
  const onWake = () => { void refresh(); };
  const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
  const onWorkerState = (event: Event) => {
    if ((event.target as ServiceWorker).state === 'redundant' && !navigator.serviceWorker.controller) {
      publish({ ready: false, updateAvailable: false, error: '离线缓存未能完整安装，请联网后重新加载并检查设备存储空间。' });
      return;
    }
    void refresh();
  };
  const onUpdateFound = () => {
    const worker = registration?.installing;
    if (worker && !observedWorkers.has(worker)) {
      observedWorkers.add(worker);
      worker.addEventListener('statechange', onWorkerState);
    }
  };
  const controller: OfflineController = {
    async acceptUpdate() {
      const waiting = registration?.waiting;
      if (!waiting || disposed) return;
      accepting = true;
      waiting.postMessage({ type: 'ACCEPT_UPDATE' });
    },
    refresh,
    dispose() {
      disposed = true;
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onVisible);
      registration?.removeEventListener('updatefound', onUpdateFound);
      for (const worker of observedWorkers) worker.removeEventListener('statechange', onWorkerState);
    },
  };
  publish(status);
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    publish({ ready: false, updateAvailable: false, error: '此浏览器或当前地址不支持离线安装；请使用 HTTPS 或本机 localhost。' });
    return controller;
  }
  try {
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onVisible);
    const base = new URL(import.meta.env.BASE_URL, window.location.href);
    registration = await navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' });
    registration.addEventListener('updatefound', onUpdateFound);
    onUpdateFound();
    await refresh();
    // First installation activates itself and claims this page; no reload is necessary.
    void navigator.serviceWorker.ready.then(() => refresh());
  } catch {
    publish({ ready: false, updateAvailable: false, error: '离线缓存安装失败，请检查存储空间并联网重试。' });
  }
  return controller;
}
