import { ContactForm } from "@/components/account/contact-form";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";
import { getSessionProfile } from "@/lib/auth/profile";

export const metadata = { title: "Contact" };

export default async function AccountContactPage() {
  const session = await getSessionProfile();
  if (!session) return null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href="/account" aria-label="Back to Account">
        Account
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>Contact</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Message Admin about driver info changes, app issues, or feature
          suggestions. Messages are emailed to configured Admin contacts.
        </p>
      </div>
      <ContactForm defaultEmail={session.email ?? ""} />
    </main>
  );
}
