/** Small line icon per category (inherits the category color via currentColor). */
const PATHS: Record<string, JSX.Element> = {
  Food: <><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M18 3c-1.5 0-3 2-3 5s1 4 3 4m0 0v9" /></>,
  Groceries: <><path d="M5 7h15l-1.5 9a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 4H3" /><circle cx="9" cy="21" r="1" /><circle cx="17" cy="21" r="1" /></>,
  Travel: <><rect x="4" y="4" width="16" height="13" rx="2" /><path d="M4 11h16M8 17l-2 3M16 17l2 3" /><circle cx="8" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></>,
  Bills: <><path d="M6 3h9l3 3v15l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  Shopping: <><path d="M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0" /></>,
  Health: <><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" /></>,
  Other: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
};
const CUSTOM = <><path d="M20 12l-8 8-8-8 8-8h6a2 2 0 0 1 2 2z" /><circle cx="16" cy="8" r="1.2" /></>;
const SETTLE = <path d="M4 8h13l-3-3M20 16H7l3 3" />;

export function CategoryIcon({ cat, settlement }: { cat?: string; settlement?: boolean }) {
  const body = settlement ? SETTLE : cat && PATHS[cat] ? PATHS[cat] : CUSTOM;
  return <svg viewBox="0 0 24 24" aria-hidden="true">{body}</svg>;
}
