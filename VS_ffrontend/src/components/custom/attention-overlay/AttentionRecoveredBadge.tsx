/**
 * AttentionRecoveredBadge
 *
 * A small celebratory toast that appears briefly when the user
 * triggers the attention overlay. Mounted via portal to avoid
 * header stacking-context clipping.
 */
import { createPortal } from 'react-dom';
import './attention-overlay.css';

export function AttentionRecoveredBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return createPortal(
    <div className="ao-recovered-badge" role="status" aria-live="polite">
      ✅ Attention Recovered!
    </div>,
    document.body
  );
}
