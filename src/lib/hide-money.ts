"use client";

import { useCallback, useSyncExternalStore } from "react";

export const HIDE_MONEY_STORAGE_KEY = "pf-hide-money";

const HIDE_MONEY_EVENT = "pf-hide-money-change";

export function readHideMoney(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(HIDE_MONEY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHideMoney(hidden: boolean): void {
  try {
    localStorage.setItem(HIDE_MONEY_STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HIDE_MONEY_EVENT));
  }
}

function subscribeHideMoney(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === HIDE_MONEY_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(HIDE_MONEY_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(HIDE_MONEY_EVENT, onStoreChange);
  };
}

/** Persist and sync hide-earnings preference (localStorage). */
export function useHideMoney(): {
  hideMoney: boolean;
  setHideMoney: (hidden: boolean) => void;
  toggleHideMoney: () => void;
} {
  const hideMoney = useSyncExternalStore(
    subscribeHideMoney,
    readHideMoney,
    () => false,
  );

  const setHideMoney = useCallback((hidden: boolean) => {
    writeHideMoney(hidden);
  }, []);

  const toggleHideMoney = useCallback(() => {
    writeHideMoney(!readHideMoney());
  }, []);

  return { hideMoney, setHideMoney, toggleHideMoney };
}
