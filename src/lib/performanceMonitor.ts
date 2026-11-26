import type { ProfilerOnRenderCallback } from 'react';

export type ProfilerPhase = 'mount' | 'update' | 'nested-update';

export interface RenderMetricSample {
  id: string;
  phase: ProfilerPhase;
  actualDurationMs: number;
  baseDurationMs: number;
  startTime: number;
  commitTime: number;
  itemCount: number | null;
  slow: boolean;
  recordedAt: number;
}

export interface ProfilerSummary {
  id: string;
  rendersCount: number;
  mountCount: number;
  updateCount: number;
  nestedUpdateCount: number;
  slowRendersCount: number;
  lastPhase: ProfilerPhase;
  lastActualDurationMs: number;
  lastBaseDurationMs: number;
  avgActualDurationMs: number;
  maxActualDurationMs: number;
  totalActualDurationMs: number;
  lastItemCount: number | null;
  lastCommitTime: number;
  updatedAt: number;
}

export interface ComponentLoadMetric {
  componentName: string;
  chunkLoadMs: number;
  mountActualDurationMs: number | null;
  mountBaseDurationMs: number | null;
  totalLoadToMountMs: number | null;
  attempts: number;
  status: 'loaded' | 'error';
  errorMessage?: string;
  startedAt: number;
  loadedAt: number;
  mountedAt: number | null;
}

export interface PerformanceMonitorSnapshot {
  slowRenderThresholdMs: number;
  profilers: ProfilerSummary[];
  componentLoads: ComponentLoadMetric[];
  recentSlowRenders: RenderMetricSample[];
  recentRenders: RenderMetricSample[];
  totalRenders: number;
  totalSlowRenders: number;
  totalComponentLoads: number;
}

export interface ProfilerOnRenderOptions {
  itemCount?: number;
  slowThresholdMs?: number;
  trackComponentLoad?: boolean;
}

export const DEFAULT_SLOW_RENDER_THRESHOLD_MS = 16;

const MAX_RECENT_RENDERS = 80;
const MAX_SLOW_RENDERS = 40;
const MAX_COMPONENT_LOADS = 60;

const profilerSummaries = new Map<string, ProfilerSummary>();
const componentLoads = new Map<string, ComponentLoadMetric>();
const activeLoadStarts = new Map<string, number>();
const recentRenders: RenderMetricSample[] = [];
const recentSlowRenders: RenderMetricSample[] = [];
const listeners = new Set<() => void>();

let totalRendersCounter = 0;
let totalSlowRendersCounter = 0;
let notifyScheduled = false;
let cachedSnapshot: PerformanceMonitorSnapshot | null = null;

function roundMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

function nowPerf(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function safePerformanceMeasure(name: string, startMark: string, endMark: string): void {
  if (
    typeof performance === 'undefined' ||
    typeof performance.mark !== 'function' ||
    typeof performance.measure !== 'function'
  ) {
    return;
  }
  try {
    performance.measure(name, startMark, endMark);
  } catch {
    // Ignore missing/cleared marks across concurrent reloads
  }
}

function scheduleNotify(): void {
  cachedSnapshot = null;
  if (listeners.size === 0 || notifyScheduled) return;
  notifyScheduled = true;

  const flush = () => {
    notifyScheduled = false;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Keep monitor isolated from subscriber errors
      }
    }
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(flush);
  } else {
    setTimeout(flush, 0);
  }
}

export function recordComponentLoadStart(componentName: string): number {
  const cleanName = componentName.trim();
  if (!cleanName) return nowPerf();
  const startedAt = nowPerf();
  activeLoadStarts.set(cleanName, startedAt);
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark(`ec:load:start:${cleanName}`);
    } catch {
      // Ignore UserTiming mark errors
    }
  }
  return startedAt;
}

export function recordComponentLoadComplete(input: {
  componentName: string;
  durationMs: number;
  attempts: number;
  status: 'loaded' | 'error';
  errorMessage?: string;
  startedAt?: number;
}): ComponentLoadMetric {
  const cleanName = input.componentName.trim() || 'UnknownComponent';
  const loadedAt = nowPerf();
  const startedAt = input.startedAt ?? activeLoadStarts.get(cleanName) ?? Math.max(0, loadedAt - input.durationMs);
  activeLoadStarts.delete(cleanName);

  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      const endMark = `ec:load:end:${cleanName}`;
      performance.mark(endMark);
      safePerformanceMeasure(`ec:load:${cleanName}`, `ec:load:start:${cleanName}`, endMark);
    } catch {
      // Ignore UserTiming mark errors
    }
  }

  const chunkLoadMs = roundMs(input.durationMs);
  const existing = componentLoads.get(cleanName);
  const metric: ComponentLoadMetric = {
    componentName: cleanName,
    chunkLoadMs,
    mountActualDurationMs: input.status === 'loaded' ? existing?.mountActualDurationMs ?? null : null,
    mountBaseDurationMs: input.status === 'loaded' ? existing?.mountBaseDurationMs ?? null : null,
    totalLoadToMountMs:
      input.status === 'loaded' && existing?.mountedAt != null
        ? roundMs(existing.mountedAt - startedAt)
        : input.status === 'loaded'
          ? chunkLoadMs
          : null,
    attempts: Math.max(1, Math.round(input.attempts)),
    status: input.status,
    errorMessage: input.errorMessage ? input.errorMessage.slice(0, 240) : undefined,
    startedAt: roundMs(startedAt),
    loadedAt: roundMs(loadedAt),
    mountedAt: input.status === 'loaded' ? existing?.mountedAt ?? null : null,
  };

  if (componentLoads.size >= MAX_COMPONENT_LOADS && !componentLoads.has(cleanName)) {
    const oldestKey = componentLoads.keys().next().value;
    if (oldestKey) componentLoads.delete(oldestKey);
  }
  componentLoads.set(cleanName, metric);
  scheduleNotify();
  return metric;
}

export function markComponentMounted(
  componentName: string,
  mountActualDurationMs: number,
  mountBaseDurationMs: number,
): void {
  const cleanName = componentName.trim();
  if (!cleanName) return;
  const mountedAt = nowPerf();
  const existing = componentLoads.get(cleanName);
  const roundedActual = roundMs(mountActualDurationMs);
  const roundedBase = roundMs(mountBaseDurationMs);

  if (existing) {
    if (existing.mountedAt === null) {
      const totalFromStart =
        mountedAt >= existing.startedAt
          ? roundMs(mountedAt - existing.startedAt)
          : roundMs(existing.chunkLoadMs + roundedActual);
      componentLoads.set(cleanName, {
        ...existing,
        mountActualDurationMs: roundedActual,
        mountBaseDurationMs: roundedBase,
        totalLoadToMountMs: Math.max(existing.chunkLoadMs, totalFromStart),
        mountedAt: roundMs(mountedAt),
      });
      scheduleNotify();
    }
    return;
  }

  componentLoads.set(cleanName, {
    componentName: cleanName,
    chunkLoadMs: 0,
    mountActualDurationMs: roundedActual,
    mountBaseDurationMs: roundedBase,
    totalLoadToMountMs: roundedActual,
    attempts: 1,
    status: 'loaded',
    startedAt: roundMs(Math.max(0, mountedAt - roundedActual)),
    loadedAt: roundMs(mountedAt),
    mountedAt: roundMs(mountedAt),
  });
  scheduleNotify();
}

export function recordProfilerRender(input: {
  id: string;
  phase: ProfilerPhase;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  itemCount?: number;
  slowThresholdMs?: number;
  trackComponentLoad?: boolean;
}): RenderMetricSample {
  const threshold = input.slowThresholdMs ?? DEFAULT_SLOW_RENDER_THRESHOLD_MS;
  const actualDurationMs = roundMs(input.actualDuration);
  const baseDurationMs = roundMs(input.baseDuration);
  const slow = actualDurationMs > threshold;
  const recordedAt = Date.now();
  const itemCount =
    typeof input.itemCount === 'number' && Number.isFinite(input.itemCount) && input.itemCount >= 0
      ? Math.round(input.itemCount)
      : null;

  const sample: RenderMetricSample = {
    id: input.id,
    phase: input.phase,
    actualDurationMs,
    baseDurationMs,
    startTime: roundMs(input.startTime),
    commitTime: roundMs(input.commitTime),
    itemCount,
    slow,
    recordedAt,
  };

  totalRendersCounter += 1;
  if (slow) {
    totalSlowRendersCounter += 1;
    recentSlowRenders.unshift(sample);
    if (recentSlowRenders.length > MAX_SLOW_RENDERS) {
      recentSlowRenders.length = MAX_SLOW_RENDERS;
    }
  }

  recentRenders.unshift(sample);
  if (recentRenders.length > MAX_RECENT_RENDERS) {
    recentRenders.length = MAX_RECENT_RENDERS;
  }

  const prev = profilerSummaries.get(input.id);
  const nextRendersCount = (prev?.rendersCount ?? 0) + 1;
  const nextTotalActual = roundMs((prev?.totalActualDurationMs ?? 0) + actualDurationMs);

  const summary: ProfilerSummary = {
    id: input.id,
    rendersCount: nextRendersCount,
    mountCount: (prev?.mountCount ?? 0) + (input.phase === 'mount' ? 1 : 0),
    updateCount: (prev?.updateCount ?? 0) + (input.phase === 'update' ? 1 : 0),
    nestedUpdateCount: (prev?.nestedUpdateCount ?? 0) + (input.phase === 'nested-update' ? 1 : 0),
    slowRendersCount: (prev?.slowRendersCount ?? 0) + (slow ? 1 : 0),
    lastPhase: input.phase,
    lastActualDurationMs: actualDurationMs,
    lastBaseDurationMs: baseDurationMs,
    avgActualDurationMs: roundMs(nextTotalActual / nextRendersCount),
    maxActualDurationMs: Math.max(prev?.maxActualDurationMs ?? 0, actualDurationMs),
    totalActualDurationMs: nextTotalActual,
    lastItemCount: itemCount ?? prev?.lastItemCount ?? null,
    lastCommitTime: roundMs(input.commitTime),
    updatedAt: recordedAt,
  };

  profilerSummaries.set(input.id, summary);

  if (input.trackComponentLoad && input.phase === 'mount') {
    markComponentMounted(input.id, actualDurationMs, baseDurationMs);
  }

  scheduleNotify();
  return sample;
}

export function createProfilerOnRender(
  id: string,
  options: ProfilerOnRenderOptions = {},
): ProfilerOnRenderCallback {
  return (_profilerId, phase, actualDuration, baseDuration, startTime, commitTime) => {
    recordProfilerRender({
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      itemCount: options.itemCount,
      slowThresholdMs: options.slowThresholdMs,
      trackComponentLoad: options.trackComponentLoad,
    });
  };
}

export function getPerformanceSnapshot(): PerformanceMonitorSnapshot {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const profilers = Array.from(profilerSummaries.values()).sort(
    (a, b) => b.maxActualDurationMs - a.maxActualDurationMs || b.rendersCount - a.rendersCount,
  );
  const loads = Array.from(componentLoads.values()).sort((a, b) => b.loadedAt - a.loadedAt);

  cachedSnapshot = {
    slowRenderThresholdMs: DEFAULT_SLOW_RENDER_THRESHOLD_MS,
    profilers,
    componentLoads: loads,
    recentSlowRenders: [...recentSlowRenders],
    recentRenders: [...recentRenders],
    totalRenders: totalRendersCounter,
    totalSlowRenders: totalSlowRendersCounter,
    totalComponentLoads: loads.length,
  };
  return cachedSnapshot;
}

export function subscribePerformanceMonitor(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearPerformanceMetrics(): void {
  profilerSummaries.clear();
  componentLoads.clear();
  activeLoadStarts.clear();
  recentRenders.length = 0;
  recentSlowRenders.length = 0;
  totalRendersCounter = 0;
  totalSlowRendersCounter = 0;
  cachedSnapshot = null;
  scheduleNotify();
}

export function exportPerformanceReport(): {
  generatedAt: string;
  slowRenderThresholdMs: number;
  summary: {
    totalRenders: number;
    totalSlowRenders: number;
    trackedProfilers: number;
    trackedComponentLoads: number;
  };
  profilers: ProfilerSummary[];
  componentLoads: ComponentLoadMetric[];
  recentSlowRenders: RenderMetricSample[];
} {
  const snap = getPerformanceSnapshot();
  return {
    generatedAt: new Date().toISOString(),
    slowRenderThresholdMs: snap.slowRenderThresholdMs,
    summary: {
      totalRenders: snap.totalRenders,
      totalSlowRenders: snap.totalSlowRenders,
      trackedProfilers: snap.profilers.length,
      trackedComponentLoads: snap.componentLoads.length,
    },
    profilers: snap.profilers,
    componentLoads: snap.componentLoads,
    recentSlowRenders: snap.recentSlowRenders,
  };
}

declare global {
  interface Window {
    __EC_PERF__?: {
      getSnapshot: typeof getPerformanceSnapshot;
      exportReport: typeof exportPerformanceReport;
      clear: typeof clearPerformanceMetrics;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__EC_PERF__ = {
    getSnapshot: getPerformanceSnapshot,
    exportReport: exportPerformanceReport,
    clear: clearPerformanceMetrics,
  };
}
