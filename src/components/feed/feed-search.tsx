"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function FeedSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialQuery);

  function applyFilter(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    // New search starts at page 1; keep week filter if present.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/feed?${qs}` : "/feed");
    });
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        applyFilter(value);
      }}
    >
      <label htmlFor="feed-asset-search" className="sr-only">
        Filter feed by trailer or asset number
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-brand"
        />
        <input
          id="feed-asset-search"
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (value.trim() !== initialQuery.trim()) applyFilter(value);
          }}
          placeholder="Search by trailer or tractor number"
          autoComplete="off"
          enterKeyHint="search"
          disabled={pending}
          className="min-h-12 w-full rounded-xl border border-brand/40 bg-card py-3 pl-11 pr-3.5 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        />
      </div>
    </form>
  );
}
