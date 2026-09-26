export default function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 animate-pulse" role="status" aria-label="Chargement">
      <div className="h-6 w-1/3 rounded-md" style={{ background: "var(--surface-alt)" }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card h-16" style={{ background: "var(--surface-alt)" }} />
      ))}
    </div>
  );
}
