export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">
      <div className="animate-fade-up">
        <p className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-10 rounded-lg border border-dashed bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Coming in a later phase.</p>
      </div>
    </div>
  )
}
