import Link from "next/link";
import { AccountNavCard } from "@/components/account/account-nav-card";
import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";

export const metadata = { title: "Legal" };

export default function AccountLegalPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href="/account" aria-label="Back to Account">
        Account
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>Legal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          FAQ and draft policies for PrivateFleet. Final reviewed copy can
          replace these pages later.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <AccountNavCard
          href="/account/legal/faq"
          title="FAQ"
          description="What the app is, privacy, and Safety access"
        />
        <AccountNavCard
          href="/account/legal/privacy"
          title="Privacy Policy"
          description="How we handle account, load, and damage data"
        />
        <AccountNavCard
          href="/account/legal/terms"
          title="Terms of Service"
          description="Rules for using PrivateFleet"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Questions?{" "}
        <Link href="/account/contact" className="text-brand underline">
          Contact Admin
        </Link>
        .
      </p>
    </main>
  );
}
