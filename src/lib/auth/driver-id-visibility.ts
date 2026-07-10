import type { UserRole } from "@/types/database";

/**
 * Company Driver IDs on damage reports / feed replies are visible to:
 * - the subject themself (reporter or comment author)
 * - Safety and Admin (fleet visibility)
 * Peer drivers only see display name + work-state identity.
 */
export function canViewDriverId(opts: {
  viewerRole: UserRole;
  viewerUserId: string;
  subjectUserId: string | null | undefined;
}): boolean {
  if (opts.viewerRole === "safety" || opts.viewerRole === "admin") return true;
  if (opts.subjectUserId && opts.viewerUserId === opts.subjectUserId) {
    return true;
  }
  return false;
}
