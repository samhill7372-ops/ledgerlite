/** Tiny bar strip (last-N daily totals), last bar emphasized. Theme-light on the hero. */
export function Sparkbars({ values, label }: { values: number[]; label?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="sparkbars" role="img" aria-label={label ?? 'recent spending'}>
      {values.map((v, i) => (
        <i key={i} className={i === values.length - 1 ? 'now' : ''} style={{ height: (v > 0 ? Math.max(14, (v / max) * 100) : 6) + '%' }} />
      ))}
    </div>
  );
}
