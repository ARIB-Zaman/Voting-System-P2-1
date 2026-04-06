import { useState, useCallback, useRef } from 'react';

export type OverlayState = 'hidden' | 'visible';

export interface UseAttentionOverlayReturn {
  overlayState: OverlayState;
  isRecovered: boolean;
  triggerAttention: () => void;
  dismissOverlay: () => void;
}

/**
 * useAttentionOverlay
 *
 * Manages the attention overlay state:
 * - overlayState: whether the floating video overlay is shown
 * - isRecovered: transient "Attention Recovered!" feedback state (3 s TTL)
 * - triggerAttention: toggles overlay on with feedback message
 * - dismissOverlay: hides overlay without feedback
 *
 * Designed to be extended for idle-detection auto-trigger by exposing
 * triggerAttention as a stable ref-safe callback.
 */
export function useAttentionOverlay(): UseAttentionOverlayReturn {
  const [overlayState, setOverlayState] = useState<OverlayState>('hidden');
  const [isRecovered, setIsRecovered] = useState(false);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAttention = useCallback(() => {
    if (overlayState === 'visible') {
      // Already showing — dismiss instead
      setOverlayState('hidden');
      return;
    }

    setOverlayState('visible');
    setIsRecovered(true);

    // Clear any previous timer
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);

    // Auto-clear the "recovered" badge after 3 seconds
    recoveryTimerRef.current = setTimeout(() => {
      setIsRecovered(false);
    }, 3000);
  }, [overlayState]);

  const dismissOverlay = useCallback(() => {
    setOverlayState('hidden');
    setIsRecovered(false);
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
  }, []);

  return { overlayState, isRecovered, triggerAttention, dismissOverlay };
}
