"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  assetNumberDigits,
  feedUnitHref,
} from "@/lib/feed/asset-number";

export function FeedSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(initialQuery);

  function applySearch(next: string) {
    const digits = assetNumberDigits(next);
    startTransition(() => {
      if (digits) {
        router.push(feedUnitHref(digits));
        return;
      }
      router.push("/feed");
    });
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        applySearch(value);
      }}
    >
      <label htmlFor="feed-asset-search" className="sr-only">
        Search feed by trailer or tractor number
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
          placeholder="Search by trailer or tractor number"
          autoComplete="off"
          enterKeyHint="search"
          inputMode="numeric"
          disabled={pending}
          className="min-h-12 w-full rounded-xl border border-brand/40 bg-card py-3 pl-11 pr-3.5 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        />
      </div>
    </form>
  );
}
