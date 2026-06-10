export function LoadingState() {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm dark:border-darkBorder dark:bg-darkCard">
      <div className="space-y-4">
        <div className="h-7 w-48 animate-pulse rounded-full bg-cream dark:bg-darkBg" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-2xl bg-cream dark:bg-darkBg" />
          ))}
        </div>
      </div>
    </div>
  );
}
