export function FlowSteps({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li
            key={label}
            className={`rounded-2xl px-2 py-2 text-center text-[11px] font-medium leading-4 ${
              active
                ? "bg-primary text-primary-foreground"
                : done
                  ? "bg-accent text-teal"
                  : "bg-white text-muted-foreground ring-1 ring-border"
            }`}
          >
            {index + 1}. {label}
          </li>
        )
      })}
    </ol>
  )
}
