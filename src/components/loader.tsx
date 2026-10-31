export function Loader({
  fullscreen = false,
  label = "იტვირთება",
}: {
  fullscreen?: boolean;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-5 ${
        fullscreen ? "min-h-dvh" : "min-h-[60vh]"
      }`}
    >
      <div className="relative size-20">
        <span className="absolute inset-0 rounded-full border-4 border-muted" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-green-600 border-r-green-600/40" />
        <span className="absolute inset-4 grid grid-cols-2 gap-1">
          <i className="animate-pulse rounded-[3px] bg-green-700 [animation-delay:-0.6s]" />
          <i className="animate-pulse rounded-[3px] bg-green-500 [animation-delay:-0.45s]" />
          <i className="animate-pulse rounded-[3px] bg-green-500 [animation-delay:-0.3s]" />
          <i className="animate-pulse rounded-[3px] bg-green-700 [animation-delay:-0.15s]" />
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        <span className="flex gap-1">
          <i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <i className="size-1.5 animate-bounce rounded-full bg-current" />
        </span>
      </div>
    </div>
  );
}