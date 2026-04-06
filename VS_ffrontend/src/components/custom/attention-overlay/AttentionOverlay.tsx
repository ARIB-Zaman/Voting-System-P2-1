import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, Volume2, VolumeX } from 'lucide-react';
import { useAttentionOverlayContext } from './AttentionOverlayContext';
import './attention-overlay.css';

/**
 * VIDEO_SOURCES
 *
 * Real YouTube short-form videos embedded via the IFrame API.
 * autoplay=1  – starts playing on mount
 * mute=1      – required for browser autoplay policy
 * loop=1      – loops forever (needs playlist=VIDEO_ID for YouTube API)
 * controls=0  – hides native YT controls (we provide our own HUD)
 * enablejsapi=1 – allows postMessage commands (mute/unmute)
 * rel=0       – no related videos at the end
 * playsinline=1 – mobile inline play
 * modestbranding=1 – minimal YouTube branding
 */
const VIDEO_SOURCES: Array<{
  id: string;
  youtubeId: string;
  label: string;
  accent: string;
  side: 'left' | 'right';
}> = [
  {
    id: 'minecraft',
    youtubeId: 'V2rPYLtY75k', // https://www.youtube.com/shorts/V2rPYLtY75k
    label: '⛏️ Minecraft Parkour',
    accent: '#22c55e',
    side: 'left',
  },
  {
    id: 'subway',
    youtubeId: 'QPW3XwBoQlw', // https://www.youtube.com/watch?v=QPW3XwBoQlw
    label: '🛹 Subway Surfers',
    accent: '#f59e0b',
    side: 'right',
  },
];

/**
 * Build the YouTube embed URL with all necessary parameters.
 * `origin` is set to the current page's origin for postMessage security.
 */
function buildEmbedUrl(youtubeId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',        // start muted (browser autoplay policy)
    loop: '1',
    playlist: youtubeId, // required for loop to work
    controls: '0',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
    enablejsapi: '1',   // enables postMessage API
    origin: window.location.origin,
    iv_load_policy: '3', // hide annotations
  });
  return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
}

/**
 * Send a YouTube IFrame API command via postMessage.
 * Works because we set enablejsapi=1 in the embed URL.
 */
function sendYTCommand(iframe: HTMLIFrameElement, func: string, args: unknown[] = []) {
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  );
}

// ── Single floating video card (YouTube iframe) ────────────────────────────────

interface VideoCardProps {
  youtubeId: string;
  label: string;
  accent: string;
  side: 'left' | 'right';
  visible: boolean;
}

const VideoCard = memo(function VideoCard({
  youtubeId,
  label,
  accent,
  side,
  visible,
}: VideoCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  // When overlay becomes visible, send play command (iframe starts muted anyway).
  // When hidden, pause to save bandwidth.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (visible) {
      // Small delay to ensure iframe is fully loaded before postMessage
      const timer = setTimeout(() => {
        sendYTCommand(iframe, 'playVideo');
        sendYTCommand(iframe, 'mute');
      }, 600);
      return () => clearTimeout(timer);
    } else {
      sendYTCommand(iframe, 'pauseVideo');
    }
  }, [visible]);

  // Sync our muted state to the iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !visible) return;
    sendYTCommand(iframe, muted ? 'mute' : 'unMute');
  }, [muted, visible]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const embedUrl = buildEmbedUrl(youtubeId);

  return (
    <div
      className={`ao-video-card ao-video-card--${side}`}
      style={{ '--ao-accent': accent } as React.CSSProperties}
      data-visible={visible}
    >
      {/* Accent glow ring */}
      <div className="ao-glow-ring" />

      {/* YouTube iframe embed — fills the 9:16 card */}
      <iframe
        ref={iframeRef}
        className="ao-video"
        src={embedUrl}
        title={label}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen={false}
        loading="lazy"
        // Prevent the iframe from receiving pointer events so overlay pass-through
        // still works when not hovering over the card
        style={{ border: 'none', pointerEvents: 'auto' }}
      />

      {/* Overlay HUD (label + mute) — sits on top of the iframe */}
      <div className="ao-hud">
        <span className="ao-label">{label}</span>
        <button
          id={`ao-mute-${side}`}
          className="ao-mute-btn"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      {/* Bottom gradient scrim — purely decorative */}
      <div className="ao-scrim" />
    </div>
  );
});

// ── Main Overlay Portal ───────────────────────────────────────────────────────

/**
 * AttentionOverlay
 *
 * Renders two floating PiP-style YouTube iframes via React Portal
 * mounted at document.body — zero layout impact on the app.
 *
 * pointer-events: none on the root passes all clicks through to the
 * app below; only the card shells and HUD buttons are interactive.
 */
export function AttentionOverlay() {
  const { overlayState, dismissOverlay } = useAttentionOverlayContext();
  const visible = overlayState === 'visible';

  const overlay = (
    <div
      className={`ao-root ${visible ? 'ao-root--visible' : ''}`}
      role="complementary"
      aria-label="Attention overlay"
      aria-hidden={!visible}
    >
      {/* Subtle translucent backdrop — pass-through for clicks */}
      <div className="ao-backdrop" aria-hidden="true" />

      {/* Center dismiss pill */}
      {visible && (
        <button
          id="ao-dismiss-btn"
          className="ao-dismiss"
          onClick={dismissOverlay}
          aria-label="Close attention overlay"
          title="Close"
        >
          <X size={16} />
          <span>Close</span>
        </button>
      )}

      {/* Floating video cards */}
      {VIDEO_SOURCES.map((v) => (
        <VideoCard
          key={v.id}
          youtubeId={v.youtubeId}
          label={v.label}
          accent={v.accent}
          side={v.side}
          visible={visible}
        />
      ))}
    </div>
  );

  return createPortal(overlay, document.body);
}
