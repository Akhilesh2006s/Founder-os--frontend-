export function PageShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="p-6 space-y-6">
      <header className="border-b border-gold/20 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-gold-bright">{title}</h1>
        <p className="text-sm text-muted mt-1">{description}</p>
      </header>
      {children}
    </main>
  );
}

