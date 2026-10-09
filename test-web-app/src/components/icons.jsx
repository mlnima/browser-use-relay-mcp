export const Icon = ({ name, size = 20 }) => {
  const paths = {
    arrow: 'M5 12h14M13 6l6 6-6 6', check: 'm5 12 4 4L19 6',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    globe: 'M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
    reset: 'M3 9a9 9 0 1 1 1 9M3 3v6h6',
    activity: 'M2 12h5l3-8 4 16 3-8h5', file: 'M6 2h8l4 4v16H6zM14 2v6h6',
    code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid} /></svg>;
};
