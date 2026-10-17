import { useEffect, useState } from 'react';

/**
 * One-tap PWA install banner. Browsers never allow silent installs, so this is
 * as automatic as it gets: Chrome/Edge on Android fire `beforeinstallprompt`,
 * we stash it and trigger the native dialog from our button. iOS has no such
 * event, so we show the Share → Add to Home Screen instruction once.
 * Never shown when already installed (standalone) or after being dismissed.
 */
type BIPEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const DISMISSED = 'll.install.dismissed.v1';

function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

export function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(DISMISSED)) return; } catch { /* storage blocked: still offer */ }
    if (isStandalone()) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { setIos(true); setShow(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent); setShow(true); };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  function dismiss() { try { localStorage.setItem(DISMISSED, '1'); } catch { /* ignore */ } setShow(false); }
  async function install() {
    if (!bip) return;
    await bip.prompt();
    if ((await bip.userChoice).outcome === 'accepted') setShow(false); else dismiss();
  }

  if (!show) return null;
  return (
    <div className="install" role="region" aria-label="Install the app">
      <div className="t">
        <b>Install LedgerLite</b>
        <small>{ios ? 'In Safari: tap Share, then “Add to Home Screen”.' : 'Opens full screen and keeps your sign-in safe.'}</small>
      </div>
      <div className="acts">
        {!ios && <button className="btn sm primary" onClick={install}>Install</button>}
        <button className="btn sm" onClick={dismiss}>{ios ? 'Got it' : 'Later'}</button>
      </div>
    </div>
  );
}
