import { useRef, useState } from 'react';
import { extractFields, guessCategory, type ExtractedFields } from '@/lib/ocr';
import { fmt } from '@/lib/money';
import type { Category } from '@/types';

export interface ScanResult extends ExtractedFields { category: Category; rawText: string; confidence: number }

export function BillScanner({ onResult, onClear }: { onResult: (r: ScanResult) => void; onClear: () => void }) {
  const camRef = useRef<HTMLInputElement>(null); const galRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Blob | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState(''); const [result, setResult] = useState<ScanResult | null>(null);

  function pick(f: File | undefined) {
    if (!f) return; if (!f.type.startsWith('image/')) { setErr('Choose an image file'); return; }
    setFile(f); setPreview(URL.createObjectURL(f)); setStatus('Ready to scan.'); setErr(''); setResult(null);
  }
  function clear() {
    setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); setStatus(''); setErr(''); setResult(null); setProgress(null);
    if (camRef.current) camRef.current.value = ''; if (galRef.current) galRef.current.value = ''; onClear();
  }
  async function scan() {
    if (!file) return; setBusy(true); setErr(''); setProgress(0); setStatus('Loading OCR engine…');
    try {
      const { downscaleImage, recognize } = await import('@/lib/ocr/worker');
      const small = await downscaleImage(file);
      const r = await recognize(small, (p) => { if (p.status === 'recognizing text') { setProgress(p.progress); setStatus(`Reading text… ${Math.round(p.progress * 100)}%`); } else if (p.status) setStatus(p.status.replace(/^./, (c) => c.toUpperCase()) + '…'); });
      const fields = extractFields(r.text);
      const res: ScanResult = { ...fields, category: guessCategory(r.text), rawText: r.text, confidence: r.confidence };
      setResult(res); setStatus(`Done. Confidence ${Math.round(r.confidence)}%. Check the form and save.`); onResult(res);
    } catch (e) {
      setErr('Scan failed: ' + ((e as Error).message || 'unknown error') + '. Type the values in instead.');
    } finally { setBusy(false); setProgress(null); }
  }

  return (
    <div>
      <div className="bigbtns">
        <button type="button" className={'bigbtn' + (file ? ' on' : '')} onClick={() => camRef.current?.click()}>
          <svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Take photo of bill</button>
        <button type="button" className="bigbtn" onClick={() => galRef.current?.click()}>
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg>Choose from gallery</button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {preview && (
        <div>
          <img id="preview" className="show" src={preview} alt="Bill preview" />
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            <div className="actions">
              <button type="button" className="btn primary" onClick={scan} disabled={busy}>{busy ? 'Scanning…' : 'Scan bill'}</button>
              <button type="button" className="btn" onClick={clear} disabled={busy} style={{ flex: '0 0 auto' }}>Remove</button>
            </div>
            <div className="ocr-status">{busy && <span className="spin" />}{status}</div>
            {progress !== null && <div className="bar"><i style={{ width: Math.round(progress * 100) + '%' }} /></div>}
            {err && <p className="note err">{err}</p>}
            {result && (<>
              <div className="extracted">
                <div>Vendor<b>{result.vendor || 'not found'}</b></div>
                <div>Date<b>{result.date || 'not found'}</b></div>
                <div>Total<b>{result.total != null ? fmt(result.total) : 'not found'}</b></div>
              </div>
              <details><summary className="note" style={{ cursor: 'pointer' }}>Raw scanned text</summary><pre className="raw">{result.rawText}</pre></details>
            </>)}
            <p className="note">Scanned values are filled into the form below. Check them before saving.</p>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />
        </div>
      )}
    </div>
  );
}
