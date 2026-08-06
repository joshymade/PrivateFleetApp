"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSplashText } from "@/app/(app)/account/actions";
import { DEFAULT_SPLASH_TEXT } from "@/lib/splash";

type Props = {
  initialText: string;
};

export function AdminSplashTextForm({ initialText }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = text.trim() !== initialText.trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateSplashText(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">Splash screen description</span>
        <textarea
          name="splash_text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          rows={4}
          maxLength={2000}
          placeholder={DEFAULT_SPLASH_TEXT}
          className="min-h-24 rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Shown on the app splash before Enter. Leave blank to use the default
        description. Max 2000 characters.
      </p>
      <button
        type="submit"
        disabled={pending || !dirty}
        className="min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save splash text"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? <p className="text-xs text-brand">Saved.</p> : null}
    </form>
  );
}
