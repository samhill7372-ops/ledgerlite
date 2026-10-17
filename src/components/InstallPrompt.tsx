import { useEffect, useState } from 'react';

/**
 * Install/open nudges. Browsers never allow silent installs or force-launching
 * the installed app, so this is as automatic as it gets:
 * - Android Chrome fires `beforeinstallprompt`: stash it, trigger the native
 *   install dialog from our button.
 * - iOS has no such event: show the Share → Add to Home Screen tip once.
 * - Already installed but opened in a browser tab (we remember installs in
 *   localStorage): nudge to use the home-screen app instead.
 * Never shown when running installed (standalone) or after being dismissed.
 */
type BIPEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const DISMISSED = 'll.install.dismissed.v1';
const INSTALLED = 'll.pwa.installed.v1';
const OPEN_DISMISSED = 'll.openapp.dismissed.v1';

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string) { try { localStorage.setItem(k, '1'); } catch { /* ignore */ } },
};

function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

type Mode = 'install' | 'ios' | 'openapp';

export function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    if (isStandalone()) { store.set(INSTALLED); return; } // running as the app: remember and stay quiet
    if (store.get(INSTALLED)) { if (!store.get(OPEN_DISMISSED)) setMode('openapp'); return; }
    if (store.get(DISMISSED)) return;
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { setMode('ios'); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent); setMode('install'); };
    const onInstalled = () => { store.set(INSTALLED); setMode(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  function dismiss() { store.set(mode === 'openapp' ? OPEN_DISMISSED : DISMISSED); setMode(null); }
  async function install() {
    if (!bip) return;
    await bip.prompt();
    if ((await bip.userChoice).outcome === 'accepted') { store.set(INSTALLED); setMode(null); } else dismiss();
  }

  if (!mode) return null;
  const copy = {
    install: ['Install LedgerLite', 'Opens full screen and keeps your sign-in safe.'],
    ios: ['Install LedgerLite', 'In Safari: tap Share, then “Add to Home Screen”.'],
    openapp: ['You have the app', 'Open LedgerLite from your home screen — it’s faster and keeps you signed in.'],
  }[mode];
  return (
    <div className="install" role="region" aria-label="App tip">
      <div className="t"><b>{copy[0]}</b><small>{copy[1]}</small></div>
      <div className="acts">
        {mode === 'install' && <button className="btn sm primary" onClick={install}>Install</button>}
        <button className="btn sm" onClick={dismiss}>{mode === 'install' ? 'Later' : 'Got it'}</button>
      </div>
    </div>
  );
}
