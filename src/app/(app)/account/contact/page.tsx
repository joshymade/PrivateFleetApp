import { ContactTabs } from "@/components/account/contact-tabs";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { getSessionProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { ContactReply, ContactRequest } from "@/types/database";

export const metadata = { title: "Contact" };

export default async function AccountContactPage() {
  const session = await getSessionProfile();
  if (!session) return null;

  const supabase = await createClient();
  const { data: requestRows } = await supabase
    .from("contact_requests")
    .select("id, category, message, created_at")
    .eq("driver_id", session.userId)
    .order("created_at", { ascending: false });

  const requests = (requestRows ?? []) as Pick<
    ContactRequest,
    "id" | "category" | "message" | "created_at"
  >[];
  const requestById = new Map(requests.map((r) => [r.id, r]));

  let replies: (ContactReply & {
    request: Pick<ContactRequest, "category" | "message" | "created_at"> | null;
  })[] = [];

  if (requests.length > 0) {
    const { data: replyRows } = await supabase
      .from("contact_replies")
      .select("id, contact_request_id, admin_id, body, created_at, read_at")
      .in(
        "contact_request_id",
        requests.map((r) => r.id),
      )
      .order("created_at", { ascending: false });

    replies = ((replyRows ?? []) as ContactReply[]).map((r) => ({
      ...r,
      request: requestById.get(r.contact_request_id) ?? null,
    }));
  }

  const unreadCount = replies.filter((r) => !r.read_at).length;

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href="/account" aria-label="Back to Account">
        Account
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>Contact</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Message Admin about driver info changes, app issues, or feature
          suggestions. Replies appear in Inbox.
        </p>
      </div>
      <ContactTabs
        defaultEmail={session.email ?? ""}
        replies={replies}
        unreadCount={unreadCount}
      />
    </main>
  );
}
