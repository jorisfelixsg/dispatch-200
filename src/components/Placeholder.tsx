export function Placeholder({ title, step, children }: { title: string; step: number; children?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <p>Cet écran sera construit à l&apos;étape {step} du plan.</p>
        {children}
      </div>
    </section>
  );
}
