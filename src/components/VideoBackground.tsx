import { useEffect, useRef, useState } from 'react';

export const VIDEO_BACKGROUND_DEFAULT_URL = 'https://www.youtube.com/watch?v=o7fTs8et1QM';
const FALLBACK_POSTER_URL = '/assets/energocomfort/sto_110kw.jpg';

export interface VideoTimeSegment {
  start?: number;
  end?: number;
}

export interface VideoBackgroundProps {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  brightness?: number;
  tone?: 'dark' | 'light';
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
  const [mediaVisible, setMediaVisible] = useState(false);
  const [shouldRenderMedia, setShouldRenderMedia] = useState(!lazy);

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
    if (!lazy) {
      setShouldRenderMedia(true);
      return;
    }
    if (shouldRenderMedia || typeof IntersectionObserver === 'undefined') {
      setShouldRenderMedia(true);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderMedia(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [lazy, shouldRenderMedia]);

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

  const resolvedBrightness = brightness ?? (tone === 'light' ? 0.52 : 0.38);
  const clampedBrightness = Math.max(0.1, Math.min(1.6, resolvedBrightness));
  const isLightTone = tone === 'light';
  const positionClass = position === 'absolute' ? 'absolute inset-0' : 'fixed inset-0';

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="video-background"
      data-tone={tone}
      data-start={effectiveStart !== undefined ? String(effectiveStart) : undefined}
      data-end={effectiveEnd !== undefined ? String(effectiveEnd) : undefined}
      className={`${positionClass} overflow-hidden pointer-events-none select-none ${
        isLightTone ? 'bg-[#0b1929]' : 'bg-[#081421]'
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
            isLightTone ? 'brightness-75' : ''
          }`}
        />

        {shouldRenderMedia &&
          (youtubeEmbedUrl ? (
            <iframe
              ref={iframeRef}
              key={youtubeEmbedUrl}
              src={youtubeEmbedUrl}
              title="Energo Comfort solar station background video"
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
                window.setTimeout(() => setMediaVisible(true), 450);
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

        {/* Shaded backdrop-filter overlay across the container */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backdropFilter: isLightTone
              ? `brightness(${clampedBrightness}) contrast(1.06)`
              : `brightness(${clampedBrightness})`,
            WebkitBackdropFilter: isLightTone
              ? `brightness(${clampedBrightness}) contrast(1.06)`
              : `brightness(${clampedBrightness})`,
            background: isLightTone
              ? 'linear-gradient(180deg, rgba(8, 20, 33, 0.56) 0%, rgba(13, 31, 51, 0.44) 50%, rgba(8, 20, 33, 0.62) 100%)'
              : 'linear-gradient(180deg, rgba(8, 20, 33, 0.44) 0%, rgba(13, 31, 51, 0.32) 50%, rgba(8, 20, 33, 0.52) 100%)',
          }}
        />
      </div>
    </div>
  );
}
