export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${light ? "text-white" : "text-brand"}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="10" fill={light ? "#16485a" : "#0d3b4c"} />
        <path d="M16 7.5v17M7.5 16h17" stroke="#7ed9d2" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="16" cy="16" r="3.2" fill="#f4fbfb" />
      </svg>
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Saúde Prime</span>
          <span className={`block text-[11px] ${light ? "text-white/70" : "text-muted-foreground"}`}>Demonstração</span>
        </span>
      )}
    </span>
  )
}
