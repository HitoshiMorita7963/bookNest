export function BookNestLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path d="M14 44c6-3 12-3 18 0 6-3 12-3 18 0V20c-6-3-12-3-18 0-6-3-12-3-18 0z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" className="text-primary-foreground" />
      <path d="M32 20v24" stroke="currentColor" strokeWidth="3.2" className="text-primary-foreground" />
      <path d="M12 48c13 5 27 5 40 0" fill="none" stroke="var(--highlight)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
