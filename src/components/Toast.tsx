import { useApp } from '@/store/useApp';
export function Toast() {
  const { toast } = useApp();
  return (
    <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">
      {toast && (toast.undo ? <span className="undo">{toast.text}<button onClick={toast.undo}>Undo</button></span> : toast.text)}
    </div>
  );
}
