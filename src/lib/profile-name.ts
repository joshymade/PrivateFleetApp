/** Profile display name helpers. Stored as composed `profiles.full_name` like `"John S"`. */

export type NameParts = {
  firstName: string;
  lastInitial: string;
};

/** Capitalize the first character; leave the rest as typed (trimmed). */
export function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Normalize last initial to a single uppercase letter (or empty). */
export function normalizeLastInitial(value: string): string {
  const letter = value.trim().replace(/[^a-zA-Z]/g, "").charAt(0);
  return letter ? letter.toUpperCase() : "";
}

export function composeFullName(firstName: string, lastInitial: string): string {
  const first = capitalizeFirst(firstName);
  const initial = normalizeLastInitial(lastInitial);
  if (!first && !initial) return "";
  if (!initial) return first;
  if (!first) return initial;
  return `${first} ${initial}`;
}

/**
 * Parse stored `full_name` into first name + last initial.
 * Supports `"John S"`, `"John S."`, legacy multi-word names (last word → initial).
 */
export function parseFullName(fullName: string | null | undefined): NameParts {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return { firstName: "", lastInitial: "" };

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const only = parts[0]!;
    if (only.length === 1) {
      return { firstName: "", lastInitial: normalizeLastInitial(only) };
    }
    return { firstName: capitalizeFirst(only), lastInitial: "" };
  }

  const last = parts[parts.length - 1]!;
  const first = parts.slice(0, -1).join(" ");
  return {
    firstName: capitalizeFirst(first),
    lastInitial: normalizeLastInitial(last),
  };
}

/** Welcome / short display: first name, or `"First L"`, or fallback. */
export function displayFirstOrFull(
  fullName: string | null | undefined,
  fallback = "there",
): string {
  const { firstName, lastInitial } = parseFullName(fullName);
  if (firstName && lastInitial) return `${firstName} ${lastInitial}`;
  if (firstName) return firstName;
  if (lastInitial) return lastInitial;
  return fallback;
}
