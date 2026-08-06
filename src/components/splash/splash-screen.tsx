"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppLogo } from "@/components/brand/app-logo";
import {
  isSplashHiddenInStorage,
  resolveSplashEnterHref,
  setSplashHiddenForever,
} from "@/lib/splash";

type SplashScreenProps = {
  splashText: string;
  isLoggedIn: boolean;
  userId: string | null;
};

function subscribeNoop() {
  return () => {};
}

export function SplashScreen({
  splashText,
  isLoggedIn,
  userId,
}: SplashScreenProps) {
  const router = useRouter();
  const [hideForever, setHideForever] = useState(false);
  const clientReady = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const skipSplash =
    clientReady && isSplashHiddenInStorage(userId);

  useEffect(() => {
    if (!skipSplash) return;
    router.replace(resolveSplashEnterHref(isLoggedIn));
  }, [isLoggedIn, router, skipSplash]);

  function onEnter() {
    if (hideForever) {
      setSplashHiddenForever(userId);
    }
    router.replace(resolveSplashEnterHref(isLoggedIn));
  }

  if (!clientReady || skipSplash) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center bg-brand"
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-brand text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
        <AppLogo size={128} priority className="drop-shadow-sm" />

        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            PrivateFleet
          </h1>
          <p className="text-base leading-relaxed text-white/90">{splashText}</p>
        </div>

        <label className="flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm text-white">
          <input
            type="checkbox"
            checked={hideForever}
            onChange={(e) => setHideForever(e.target.checked)}
            className="size-5 shrink-0 rounded border-white/40 bg-transparent accent-accent"
          />
          <span>Hide forever</span>
        </label>

        <button
          type="button"
          onClick={onEnter}
          className="min-h-14 w-full max-w-sm rounded-xl bg-accent px-6 text-lg font-semibold text-accent-foreground shadow-sm active:scale-[0.99]"
        >
          Enter
        </button>
      </div>
    </main>
  );
}
