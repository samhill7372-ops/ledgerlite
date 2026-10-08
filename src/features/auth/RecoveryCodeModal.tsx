import { useApp } from '@/store/useApp';

export function RecoveryCodeModal({ code, onDone }: { code: string; onDone: () => void }) {
  const { showToast } = useApp();
  function copy() {
    const done = () => showToast('Recovery code copied');
    navigator.clipboard?.writeText(code).then(done).catch(() => {
      const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ } ta.remove(); done();
    });
  }
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="recTitle">
      <div className="panel modal-card">
        <div className="eyebrow">Save your recovery code</div>
        <h2 id="recTitle" style={{ margin: '6px 0 8px' }}>This is the only way to get your data back if you forget your password</h2>
        <p className="note">Because your data is encrypted with a key only you hold, we cannot reset your password for you. Store this code somewhere safe (password manager, notes app).</p>
        <div className="reccode" id="recCode">{code}</div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={copy}>Copy code</button>
          <button className="btn primary" id="recDone" onClick={onDone}>I've saved it</button>
        </div>
      </div>
    </div>
  );
}
