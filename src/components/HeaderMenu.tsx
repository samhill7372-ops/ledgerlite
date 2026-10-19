import { useState } from 'react';
import { useApp } from '@/store/useApp';

/** Calm header affordance: a lock chip for the privacy cue + a ⋮ menu for Sign out. */
export function HeaderMenu() {
  const { signOut } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="hmenu">
      <span className="lockchip" title="Encrypted on this device" aria-label="Encrypted on this device">
        <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      </span>
      <button className="hmenu-btn" aria-label="Menu" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
      </button>
      {open && (<>
        <div className="hmenu-backdrop" onClick={() => setOpen(false)} />
        <div className="hmenu-pop" role="menu">
          <div className="hmenu-info"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg> Encrypted on this device — only you can read it.</div>
          <button className="hmenu-item" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      </>)}
    </div>
  );
}
