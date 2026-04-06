import React, {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { useAttentionOverlay, type UseAttentionOverlayReturn } from './useAttentionOverlay';

/**
 * AttentionOverlayContext
 *
 * Provides overlay state and controls to any descendant component,
 * enabling the header button and the overlay itself to share state
 * without prop-drilling.
 *
 * Future extension points:
 * - Idle detection can call `triggerAttention()` from an effect
 * - API-driven video sources can be passed via additional context fields
 */
const AttentionOverlayContext = createContext<UseAttentionOverlayReturn | null>(null);

export function AttentionOverlayProvider({ children }: { children: ReactNode }) {
  const overlay = useAttentionOverlay();
  return (
    <AttentionOverlayContext.Provider value={overlay}>
      {children}
    </AttentionOverlayContext.Provider>
  );
}

export function useAttentionOverlayContext(): UseAttentionOverlayReturn {
  const ctx = useContext(AttentionOverlayContext);
  if (!ctx) {
    throw new Error('useAttentionOverlayContext must be used inside AttentionOverlayProvider');
  }
  return ctx;
}
