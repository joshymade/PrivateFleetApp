import { pageTitleClassName } from "@/components/ui/page-title";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className={pageTitleClassName}>You are offline</h1>
      <p className="text-sm text-muted-foreground">
        PrivateFleet shell is available offline. Reconnect to sync loads and
        damage reports.
      </p>
    </main>
  );
}
