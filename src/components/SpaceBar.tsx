import { useState } from 'react';
import { useApp } from '@/store/useApp';

/** Ledger switcher: Personal / shared spaces, plus create + invite. */
export function SpaceBar() {
  const { spaces, currentSpace, switchSpace, createSpace, inviteLink, showToast } = useApp();
  const [creating, setCreating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doCreate() {
    const name = (creating ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!name) { setCreating(null); return; }
    setBusy(true);
    try {
      const link = await createSpace(name);
      setCreating(null);
      try { await navigator.clipboard.writeText(link); showToast('Space created — invite link copied, paste it in WhatsApp'); }
      catch { showToast('Space created — tap Invite to share the link'); }
    } catch { showToast('Could not create the space'); }
    finally { setBusy(false); }
  }

  async function invite() {
    if (!currentSpace) return;
    const link = inviteLink(currentSpace.id);
    if (!link) { showToast('Sign in again to rebuild the invite link'); return; }
    const msg = `Join "${currentSpace.name}" on LedgerLite: ${link}`;
    if (navigator.share) { try { await navigator.share({ text: msg }); return; } catch { /* user closed the sheet */ } }
    try { await navigator.clipboard.writeText(link); showToast('Invite link copied'); } catch { showToast('Could not copy the link'); }
  }

  return (
    <div className="spacebar">
      <select value={currentSpace?.id ?? ''} aria-label="Ledger"
        onChange={(e) => { if (e.target.value === '__new__') setCreating(''); else void switchSpace(e.target.value || null); }}>
        <option value="">Personal</option>
        {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        <option value="__new__">＋ New shared space…</option>
      </select>
      {currentSpace && <button type="button" className="btn sm" onClick={invite}>Invite</button>}
      {creating !== null && (
        <div className="spacebar-new">
          <input type="text" value={creating} maxLength={30} placeholder="e.g. Family, Goa Trip" autoFocus
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doCreate(); } }} />
          <button type="button" className="btn sm primary" disabled={busy} onClick={doCreate}>{busy ? 'Creating…' : 'Create'}</button>
          <button type="button" className="btn sm" onClick={() => setCreating(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
