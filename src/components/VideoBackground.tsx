import { useEffect, useRef, useState } from 'react';

export const VIDEO_BACKGROUND_DEFAULT_URL = 'https://www.youtube.com/watch?v=o7fTs8et1QM';
const FALLBACK_POSTER_URL = '/assets/energocomfort/sto_110kw.jpg';

export interface VideoBackgroundProps {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  brightness?: number;
  className?: string;
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

export function buildYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    playsInline?: boolean;
    origin?: string;
  } = {},
): string {
  const {
    autoPlay = true,
    loop = true,
    muted = true,
    playsInline = true,
    origin = '',
  } = options;

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
  brightness = 0.4,
  className = '',
}: VideoBackgroundProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaVisible, setMediaVisible] = useState(false);

  const youtubeId = extractYouTubeVideoId(src);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const youtubeEmbedUrl = youtubeId
    ? buildYouTubeEmbedUrl(youtubeId, {
        autoPlay,
        loop,
        muted,
        playsInline,
        origin,
      })
    : null;

  useEffect(() => {
    setMediaVisible(false);
  }, [src]);

  useEffect(() => {
    if (!youtubeEmbedUrl) return;

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

    const handleMessage = (event: MessageEvent) => {
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
        info?: { playerState?: number } | number;
      };

      const playerState =
        typeof data.info === 'object' && data.info !== null
          ? data.info.playerState
          : typeof data.info === 'number' && data.event === 'onStateChange'
            ? data.info
            : undefined;

      if (playerState === 1) {
        setMediaVisible(true);
      } else if (playerState === 0 && loop && autoPlay) {
        sendPlayerCommand('seekTo', [0, true]);
        sendPlayerCommand('playVideo');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [youtubeEmbedUrl, loop, autoPlay]);

  useEffect(() => {
    if (youtubeEmbedUrl || !videoRef.current) return;
    const videoEl = videoRef.current;
    videoEl.muted = muted;
    videoEl.playsInline = playsInline;
    if (autoPlay) {
      void videoEl.play().catch(() => {
        // Fallback poster remains visible if browser blocks playback
      });
    }
  }, [youtubeEmbedUrl, autoPlay, muted, playsInline]);

  const clampedBrightness = Math.max(0.1, Math.min(1, brightness));

  return (
    <div
      aria-hidden="true"
      data-testid="video-background"
      className={`fixed inset-0 overflow-hidden pointer-events-none select-none bg-[#081421] ${className}`}
      style={{ zIndex: -1 }}
    >
      {/* Fade-in visual stage ensures smooth transition from blank dark state to video content */}
      <div className="absolute inset-0 video-bg-fade-in">
        {/* Poster fallback layer ensures instant visual coverage while video initializes */}
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />

        {youtubeEmbedUrl ? (
          <iframe
            ref={iframeRef}
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
              width: 'max(100vw, 177.78vh)',
              height: 'max(100vh, 56.25vw)',
              transform: 'translate(-50%, -50%) scale(1.08)',
            }}
          />
        ) : (
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            autoPlay={autoPlay}
            loop={loop}
            muted={muted}
            playsInline={playsInline}
            preload="auto"
            onCanPlay={() => setMediaVisible(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out ${
              mediaVisible ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Darkened backdrop-filter overlay across the entire viewport */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backdropFilter: `brightness(${clampedBrightness})`,
            WebkitBackdropFilter: `brightness(${clampedBrightness})`,
            background:
              'linear-gradient(180deg, rgba(8, 20, 33, 0.36) 0%, rgba(13, 31, 51, 0.24) 50%, rgba(8, 20, 33, 0.44) 100%)',
          }}
        />
      </div>
    </div>
  );
}
