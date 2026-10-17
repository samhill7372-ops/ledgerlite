import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Shows "Update available → Refresh" when a new deploy's service worker is waiting. */
export function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const update = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    update.current = registerSW({ onNeedRefresh: () => setShow(true) });
  }, []);

  if (!show) return null;
  return (
    <div className="install" role="region" aria-label="Update available">
      <div className="t"><b>Update available</b><small>A new version of LedgerLite is ready.</small></div>
      <div className="acts">
        <button className="btn sm primary" onClick={() => update.current?.(true)}>Refresh</button>
        <button className="btn sm" onClick={() => setShow(false)}>Later</button>
      </div>
    </div>
  );
}
