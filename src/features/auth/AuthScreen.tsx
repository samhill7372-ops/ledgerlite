import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '@/store/useApp';
import { Vault } from '@/lib/crypto';
import { RecoveryCodeModal } from './RecoveryCodeModal';

type Mode = 'login' | 'signup' | 'recover';

export function AuthScreen() {
  const { auth, session, needsUnlock, onSignedIn, showToast } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<{ code: string; next: () => void } | null>(null);

  useEffect(() => { if (needsUnlock && session) setEmail(session.email); }, [needsUnlock, session]);

  async function submit(ev: FormEvent) {
    ev.preventDefault(); setErr('');
    if (!auth) return;
    if (!Vault.supported) { setErr('This browser does not support encryption (needs HTTPS).'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Enter your name.');
        const { session: s, recoveryCode } = await auth.signUp(name, email, pass);
        setRecovery({ code: recoveryCode, next: async () => { setRecovery(null); await onSignedIn(s, true); showToast(`Welcome, ${name.trim()}!`); } });
      } else if (mode === 'recover') {
        const s = await auth.recover(email, code, pass); showToast('Password updated'); await onSignedIn(s, false);
      } else {
        const s = await auth.signIn(email, pass); await onSignedIn(s, false);
      }
    } catch (e) { setErr((e as Error).message || 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  async function demo() {
    if (!auth?.demo) return; setBusy(true);
    try { const s = await auth.demo(); await onSignedIn(s, false); } finally { setBusy(false); }
  }

  const label = mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password';
  return (
    <section className="auth">
      <div className="brand">
        <div className="logo"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg></div>
        <h1>LedgerLite</h1>
        <p>Track daily spending, scan bills, stay within budget.</p>
      </div>
      <div className="panel">
        {mode !== 'recover' && (
          <div className="switch" role="tablist">
            <button role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setErr(''); }}>Sign in</button>
            <button role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setErr(''); }}>Create account</button>
          </div>
        )}
        {mode === 'recover' && <div style={{ marginBottom: 12 }}><h2>Reset password</h2><p className="note">Enter the recovery code you saved at sign-up and choose a new password.</p></div>}
        {needsUnlock && session && mode === 'login' && <p className="note" style={{ marginBottom: 10 }}>Welcome back, {session.name.split(' ')[0]}. Enter your password to unlock your encrypted data.</p>}
        <form onSubmit={submit} autoComplete="on">
          {mode === 'signup' && <label>Your name <input type="text" id="auName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Sam" maxLength={40} required /></label>}
          <label>Email <input type="email" id="auEmail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" required /></label>
          {mode === 'recover' && <label>Recovery code <input type="text" id="auRecovery" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" style={{ textTransform: 'uppercase', fontFamily: 'ui-monospace, Menlo, monospace' }} required /></label>}
          <label>Password
            <span className="pw-wrap">
              <input type={showPw ? 'text' : 'password'} id="auPass" value={pass} onChange={(e) => setPass(e.target.value)} minLength={6} required
                placeholder={mode === 'login' ? 'Your password' : mode === 'recover' ? 'New password (6+ characters)' : 'At least 6 characters'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <p className="err" id="authErr">{err}</p>
          <button type="submit" className="btn primary" id="authBtn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Working…' : label}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {mode === 'login' && <button type="button" className="seeall" style={{ padding: '4px 0' }} onClick={() => { setMode('recover'); setErr(''); }}>Forgot password?</button>}
            {mode === 'recover' && <button type="button" className="seeall" style={{ padding: '4px 0' }} onClick={() => { setMode('login'); setErr(''); }}>Back to sign in</button>}
          </div>
        </form>
        {auth?.demo && (<>
          <div className="divider">or</div>
          <button className="btn" id="demoBtn" style={{ width: '100%' }} onClick={demo} disabled={busy}>Try the demo account</button>
        </>)}
        <p className="fine" style={{ marginTop: 12 }}>
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, verticalAlign: -2, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          {' '}End-to-end encrypted. Your expenses are encrypted on your phone with a key only you hold; not even the app's developer can read them.
        </p>
      </div>
      {recovery && <RecoveryCodeModal code={recovery.code} onDone={recovery.next} />}
    </section>
  );
}
