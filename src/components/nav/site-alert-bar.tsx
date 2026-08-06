/** Top-of-shell notice from admin-scheduled `site_alerts`. */
export function SiteAlertBar({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-center text-sm leading-snug text-foreground"
    >
      <p className="mx-auto max-w-lg font-medium">{message}</p>
    </div>
  );
}
