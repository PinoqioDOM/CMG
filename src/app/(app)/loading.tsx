export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-10 w-80 rounded bg-muted" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-32 rounded-lg bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
      </div>
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  );
}