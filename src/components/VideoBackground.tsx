import { useEffect, useRef, useState } from 'react';

export const VIDEO_BACKGROUND_DEFAULT_URL = 'https://www.youtube.com/watch?v=o7fTs8et1QM';
const FALLBACK_POSTER_URL = '/assets/energocomfort/sto_110kw.jpg';

export interface VideoTimeSegment {
  start?: number;
  end?: number;
}

export type VideoBackgroundTint =
  | 'daylight'
  | 'sky'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'teal'
  | 'warm'
  | 'slate';

export const VIDEO_TINT_PRESETS: Record<
  VideoBackgroundTint,
  {
    bgClass: string;
    lightOverlay: string;
    darkOverlay: string;
    edgeGlow: string;
  }
> = {
  daylight: {
    bgClass: 'bg-[#0b2a4f]',
    lightOverlay:
      'linear-gradient(180deg, rgba(7, 30, 62, 0.56) 0%, rgba(11, 56, 106, 0.42) 52%, rgba(5, 22, 46, 0.62) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(6, 24, 52, 0.64) 0%, rgba(10, 44, 88, 0.52) 55%, rgba(4, 18, 40, 0.70) 100%)',
    edgeGlow: 'rgba(125, 211, 252, 0.28)',
  },
  sky: {
    bgClass: 'bg-[#0a2f5c]',
    lightOverlay:
      'linear-gradient(180deg, rgba(6, 36, 74, 0.54) 0%, rgba(12, 72, 130, 0.40) 50%, rgba(5, 25, 54, 0.60) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(6, 28, 62, 0.62) 0%, rgba(11, 56, 108, 0.50) 52%, rgba(4, 20, 46, 0.68) 100%)',
    edgeGlow: 'rgba(125, 211, 252, 0.32)',
  },
  cyan: {
    bgClass: 'bg-[#09354a]',
    lightOverlay:
      'linear-gradient(180deg, rgba(5, 38, 56, 0.54) 0%, rgba(10, 82, 108, 0.40) 50%, rgba(4, 28, 44, 0.60) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(5, 32, 48, 0.62) 0%, rgba(9, 64, 88, 0.50) 52%, rgba(4, 22, 36, 0.68) 100%)',
    edgeGlow: 'rgba(103, 232, 249, 0.30)',
  },
  emerald: {
    bgClass: 'bg-[#083630]',
    lightOverlay:
      'linear-gradient(180deg, rgba(5, 38, 34, 0.56) 0%, rgba(11, 76, 64, 0.42) 50%, rgba(4, 26, 24, 0.62) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(5, 30, 28, 0.64) 0%, rgba(10, 62, 52, 0.52) 52%, rgba(4, 22, 20, 0.70) 100%)',
    edgeGlow: 'rgba(110, 231, 183, 0.28)',
  },
  amber: {
    bgClass: 'bg-[#292014]',
    lightOverlay:
      'linear-gradient(180deg, rgba(28, 22, 16, 0.54) 0%, rgba(88, 56, 16, 0.40) 50%, rgba(14, 24, 44, 0.60) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(24, 18, 12, 0.62) 0%, rgba(68, 42, 14, 0.50) 52%, rgba(12, 20, 38, 0.68) 100%)',
    edgeGlow: 'rgba(252, 211, 77, 0.30)',
  },
  indigo: {
    bgClass: 'bg-[#141f52]',
    lightOverlay:
      'linear-gradient(180deg, rgba(14, 22, 58, 0.56) 0%, rgba(38, 56, 122, 0.42) 50%, rgba(10, 18, 46, 0.62) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(12, 18, 48, 0.64) 0%, rgba(30, 44, 98, 0.52) 52%, rgba(8, 14, 38, 0.70) 100%)',
    edgeGlow: 'rgba(165, 180, 252, 0.30)',
  },
  teal: {
    bgClass: 'bg-[#083540]',
    lightOverlay:
      'linear-gradient(180deg, rgba(6, 38, 46, 0.56) 0%, rgba(11, 76, 86, 0.42) 50%, rgba(5, 26, 34, 0.62) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(5, 30, 38, 0.64) 0%, rgba(9, 60, 68, 0.52) 52%, rgba(4, 20, 28, 0.70) 100%)',
    edgeGlow: 'rgba(94, 234, 212, 0.30)',
  },
  warm: {
    bgClass: 'bg-[#2c1c1e]',
    lightOverlay:
      'linear-gradient(180deg, rgba(38, 20, 22, 0.54) 0%, rgba(92, 44, 24, 0.40) 50%, rgba(14, 24, 48, 0.60) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(30, 16, 18, 0.62) 0%, rgba(72, 34, 18, 0.50) 52%, rgba(12, 20, 40, 0.68) 100%)',
    edgeGlow: 'rgba(253, 186, 116, 0.30)',
  },
  slate: {
    bgClass: 'bg-[#10294d]',
    lightOverlay:
      'linear-gradient(180deg, rgba(12, 32, 68, 0.56) 0%, rgba(28, 66, 124, 0.42) 50%, rgba(8, 24, 52, 0.62) 100%)',
    darkOverlay:
      'linear-gradient(180deg, rgba(10, 26, 56, 0.64) 0%, rgba(22, 52, 102, 0.52) 52%, rgba(7, 18, 42, 0.70) 100%)',
    edgeGlow: 'rgba(147, 197, 253, 0.30)',
  },
};

export interface VideoBackgroundProps {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  brightness?: number;
  tone?: 'dark' | 'light';
  tint?: VideoBackgroundTint;
  start?: number;
  end?: number;
  position?: 'fixed' | 'absolute';
  lazy?: boolean;
  className?: string;
}

export function normalizeTimeSeconds(value: unknown): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.floor(value);
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;

  if (/^\d+(?:\.\d+)?s?$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed.replace(/s$/, ''));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
  }

  const hmsMatch = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
    const hours = Number.parseInt(hmsMatch[1] || '0', 10);
    const mins = Number.parseInt(hmsMatch[2] || '0', 10);
    const secs = Number.parseInt(hmsMatch[3] || '0', 10);
    const total = hours * 3600 + mins * 60 + secs;
    return Number.isFinite(total) && total >= 0 ? total : undefined;
  }

  return undefined;
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = parsed.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{6,20}$/.test(v)) return v;

      const parts = parsed.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
        return /^[A-Za-z0-9_-]{6,20}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    // Fallback regex for non-standard URLs
  }

  const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/);
  return match?.[1] ?? null;
}

export function extractYouTubeTimeRange(rawUrl: string): VideoTimeSegment {
  const trimmed = rawUrl.trim();
  if (!trimmed) return {};

  try {
    const parsed = new URL(trimmed);
    const start =
      normalizeTimeSeconds(parsed.searchParams.get('start')) ??
      normalizeTimeSeconds(parsed.searchParams.get('t'));
    const rawEnd = normalizeTimeSeconds(parsed.searchParams.get('end'));
    const end = rawEnd !== undefined && rawEnd > (start ?? 0) ? rawEnd : undefined;
    return {
      ...(start !== undefined ? { start } : {}),
      ...(end !== undefined ? { end } : {}),
    };
  } catch {
    return {};
  }
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    playsInline?: boolean;
    origin?: string;
    start?: number;
    end?: number;
  } = {},
): string {
  const {
    autoPlay = true,
    loop = true,
    muted = true,
    playsInline = true,
    origin = '',
    start,
    end,
  } = options;

  const normalizedStart = normalizeTimeSeconds(start);
  const normalizedEnd = normalizeTimeSeconds(end);

  const params = new URLSearchParams({
    autoplay: autoPlay ? '1' : '0',
    mute: muted ? '1' : '0',
    loop: loop ? '1' : '0',
    playlist: videoId,
    playsinline: playsInline ? '1' : '0',
    controls: '0',
    showinfo: '0',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    enablejsapi: '1',
  });

  if (normalizedStart !== undefined) {
    params.set('start', String(normalizedStart));
  }

  if (normalizedEnd !== undefined && normalizedEnd > (normalizedStart ?? 0)) {
    params.set('end', String(normalizedEnd));
  }

  if (origin && /^https?:\/\//i.test(origin)) {
    params.set('origin', origin);
  }

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function VideoBackground({
  src = VIDEO_BACKGROUND_DEFAULT_URL,
  poster = FALLBACK_POSTER_URL,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  brightness,
  tone = 'dark',
  tint = 'daylight',
  start,
  end,
  position = 'fixed',
  lazy = position === 'absolute',
  className = '',
}: VideoBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastLoopSeekAtRef = useRef(0);
  const revealTimeoutRef = useRef<number | null>(null);
  const [mediaVisible, setMediaVisible] = useState(false);
  const [shouldRenderMedia, setShouldRenderMedia] = useState(false);

  const youtubeId = extractYouTubeVideoId(src);
  const urlTimeRange = extractYouTubeTimeRange(src);
  const effectiveStart = normalizeTimeSeconds(start) ?? urlTimeRange.start;
  const rawEnd = normalizeTimeSeconds(end) ?? urlTimeRange.end;
  const effectiveEnd = rawEnd !== undefined && rawEnd > (effectiveStart ?? 0) ? rawEnd : undefined;

  const effectiveStartRef = useRef<number>(effectiveStart ?? 0);
  const effectiveEndRef = useRef<number | undefined>(effectiveEnd);
  effectiveStartRef.current = effectiveStart ?? 0;
  effectiveEndRef.current = effectiveEnd;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const youtubeEmbedUrl = youtubeId
    ? buildYouTubeEmbedUrl(youtubeId, {
        autoPlay,
        loop,
        muted,
        playsInline,
        origin,
        start: effectiveStart,
        end: effectiveEnd,
      })
    : null;

  const directVideoSrc =
    !youtubeEmbedUrl && (effectiveStart !== undefined || effectiveEnd !== undefined)
      ? `${src.split('#')[0]}#t=${effectiveStart ?? 0}${effectiveEnd !== undefined ? `,${effectiveEnd}` : ''}`
      : src;

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveDataEnabled =
      typeof navigator !== 'undefined' &&
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

    if (prefersReducedMotion || saveDataEnabled) {
      setShouldRenderMedia(false);
      return;
    }

    if (!lazy) {
      const win = typeof window !== 'undefined' ? window : null;
      if (!win) return;
      let timerId: number | null = null;
      let idleId: number | null = null;
      const activate = () => setShouldRenderMedia(true);

      if ('requestIdleCallback' in win) {
        idleId = (win as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
          activate,
          { timeout: 1400 },
        );
      } else {
        timerId = win.setTimeout(activate, 1000);
      }
      return () => {
        if (idleId !== null && 'cancelIdleCallback' in win) {
          (win as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        }
        if (timerId !== null) {
          win.clearTimeout(timerId);
        }
      };
    }

    if (typeof IntersectionObserver === 'undefined') {
      setShouldRenderMedia(true);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    let mountTimerId: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        if (intersecting) {
          if (mountTimerId === null) {
            mountTimerId = window.setTimeout(() => {
              mountTimerId = null;
              setShouldRenderMedia(true);
            }, 260);
          }
        } else {
          if (mountTimerId !== null) {
            window.clearTimeout(mountTimerId);
            mountTimerId = null;
          }
          setShouldRenderMedia(false);
          setMediaVisible(false);
        }
      },
      { rootMargin: '80px 0px' },
    );

    observer.observe(node);
    return () => {
      if (mountTimerId !== null) {
        window.clearTimeout(mountTimerId);
      }
      observer.disconnect();
    };
  }, [lazy]);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setMediaVisible(false);
    lastLoopSeekAtRef.current = 0;
  }, [youtubeEmbedUrl, directVideoSrc]);

  useEffect(() => {
    if (!youtubeEmbedUrl || !shouldRenderMedia) return;

    const sendPlayerCommand = (func: string, args: unknown[] = []) => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return;
      target.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
        }),
        '*',
      );
    };

    const restartSegment = () => {
      const now = Date.now();
      if (now - lastLoopSeekAtRef.current < 600) return;
      lastLoopSeekAtRef.current = now;
      sendPlayerCommand('seekTo', [effectiveStartRef.current, true]);
      sendPlayerCommand('playVideo');
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source && iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
        return;
      }
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('youtube.com') &&
        !event.origin.includes('youtube-nocookie.com')
      ) {
        return;
      }

      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        event?: string;
        info?: { playerState?: number; currentTime?: number } | number;
      };

      const playerState =
        typeof data.info === 'object' && data.info !== null
          ? data.info.playerState
          : typeof data.info === 'number' && data.event === 'onStateChange'
            ? data.info
            : undefined;

      const currentTime =
        typeof data.info === 'object' && data.info !== null && typeof data.info.currentTime === 'number'
          ? data.info.currentTime
          : undefined;

      if (playerState === 1) {
        setMediaVisible(true);
      } else if (playerState === 0 && loop && autoPlay) {
        restartSegment();
        return;
      }

      if (
        loop &&
        autoPlay &&
        currentTime !== undefined &&
        effectiveEndRef.current !== undefined &&
        currentTime >= effectiveEndRef.current - 0.2
      ) {
        restartSegment();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [youtubeEmbedUrl, shouldRenderMedia, loop, autoPlay]);

  useEffect(() => {
    if (youtubeEmbedUrl || !shouldRenderMedia || !videoRef.current) return;
    const videoEl = videoRef.current;
    videoEl.muted = muted;
    videoEl.playsInline = playsInline;
    if (autoPlay) {
      void videoEl.play().catch(() => {
        // Fallback poster remains visible if browser blocks playback
      });
    }
  }, [youtubeEmbedUrl, shouldRenderMedia, autoPlay, muted, playsInline]);

  const resolvedBrightness = brightness ?? (tone === 'light' ? 0.86 : 0.68);
  const clampedBrightness = Math.max(0.1, Math.min(1.6, resolvedBrightness));
  const isLightTone = tone === 'light';
  const tintPreset = VIDEO_TINT_PRESETS[tint] ?? VIDEO_TINT_PRESETS.daylight;
  const positionClass = position === 'absolute' ? 'absolute inset-0' : 'fixed inset-0';

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="video-background"
      data-tone={tone}
      data-tint={tint}
      data-start={effectiveStart !== undefined ? String(effectiveStart) : undefined}
      data-end={effectiveEnd !== undefined ? String(effectiveEnd) : undefined}
      className={`${positionClass} overflow-hidden pointer-events-none select-none ${
        isLightTone ? tintPreset.bgClass : 'bg-[#12263d]'
      } ${className}`}
      style={{ zIndex: -1 }}
    >
      {/* Fade-in visual stage ensures smooth transition from blank state to video content */}
      <div
        className="absolute inset-0 video-bg-fade-in"
        style={{ containerType: 'size' }}
      >
        {/* Poster fallback layer ensures instant visual coverage while video initializes */}
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover scale-105 ${
            isLightTone ? 'brightness-95 saturate-105' : 'brightness-90'
          }`}
        />

        {shouldRenderMedia &&
          (youtubeEmbedUrl ? (
            <iframe
              ref={iframeRef}
              key={youtubeEmbedUrl}
              src={youtubeEmbedUrl}
              title="Energo Comfort solar station background video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
              onLoad={() => {
                const win = iframeRef.current?.contentWindow;
                if (win) {
                  win.postMessage(JSON.stringify({ event: 'listening' }), '*');
                  if (muted) {
                    win.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                  }
                  if (autoPlay) {
                    win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
                  }
                }
                if (revealTimeoutRef.current !== null) {
                  window.clearTimeout(revealTimeoutRef.current);
                }
                revealTimeoutRef.current = window.setTimeout(() => {
                  revealTimeoutRef.current = null;
                  setMediaVisible(true);
                }, 450);
              }}
              className={`absolute top-1/2 left-1/2 border-0 pointer-events-none transition-opacity duration-1000 ease-out ${
                mediaVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                width: 'max(100cqw, 177.78cqh)',
                height: 'max(100cqh, 56.25cqw)',
                transform: 'translate(-50%, -50%) scale(1.08)',
              }}
            />
          ) : (
            <video
              ref={videoRef}
              key={directVideoSrc}
              src={directVideoSrc}
              poster={poster}
              autoPlay={autoPlay}
              loop={loop && effectiveEnd === undefined}
              muted={muted}
              playsInline={playsInline}
              preload="auto"
              onLoadedMetadata={() => {
                if (videoRef.current && effectiveStart !== undefined) {
                  videoRef.current.currentTime = effectiveStart;
                }
              }}
              onTimeUpdate={() => {
                const el = videoRef.current;
                if (!el || !loop || effectiveEnd === undefined) return;
                if (el.currentTime >= effectiveEnd) {
                  el.currentTime = effectiveStart ?? 0;
                  if (autoPlay) {
                    void el.play().catch(() => {});
                  }
                }
              }}
              onCanPlay={() => setMediaVisible(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out ${
                mediaVisible ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}

        {/* Light-tinted frosted backdrop-filter overlay across the container */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backdropFilter: isLightTone
              ? `brightness(${clampedBrightness}) saturate(1.1) contrast(1.02)`
              : `brightness(${clampedBrightness}) saturate(1.06)`,
            WebkitBackdropFilter: isLightTone
              ? `brightness(${clampedBrightness}) saturate(1.1) contrast(1.02)`
              : `brightness(${clampedBrightness}) saturate(1.06)`,
            background: isLightTone ? tintPreset.lightOverlay : tintPreset.darkOverlay,
            boxShadow: `inset 0 1px 0 ${tintPreset.edgeGlow}`,
          }}
        />
      </div>
    </div>
  );
}
