import { Profiler, useCallback, useRef, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { DEFAULT_SLOW_RENDER_THRESHOLD_MS, recordProfilerRender } from '../lib/performanceMonitor.ts';

interface PerformanceProfilerProps {
  id: string;
  itemCount?: number;
  slowThresholdMs?: number;
  trackLoad?: boolean;
  children: ReactNode;
}

export function PerformanceProfiler({
  id,
  itemCount,
  slowThresholdMs = DEFAULT_SLOW_RENDER_THRESHOLD_MS,
  trackLoad = false,
  children,
}: PerformanceProfilerProps) {
  const itemCountRef = useRef<number | undefined>(itemCount);
  itemCountRef.current = itemCount;

  const slowThresholdRef = useRef<number>(slowThresholdMs);
  slowThresholdRef.current = slowThresholdMs;

  const trackLoadRef = useRef<boolean>(trackLoad);
  trackLoadRef.current = trackLoad;

  const handleRender = useCallback<ProfilerOnRenderCallback>(
    (_profilerId, phase, actualDuration, baseDuration, startTime, commitTime) => {
      recordProfilerRender({
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
        itemCount: itemCountRef.current,
        slowThresholdMs: slowThresholdRef.current,
        trackComponentLoad: trackLoadRef.current,
      });
    },
    [id],
  );

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
