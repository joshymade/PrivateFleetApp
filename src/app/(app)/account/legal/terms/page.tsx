import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";

export const metadata = { title: "Terms of Service" };

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href="/account/legal" aria-label="Back to Legal">
        Legal
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>Terms of Service</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Draft — last updated July 16, 2026. Not legal advice.
        </p>
      </div>
      <article className="space-y-4 text-sm text-foreground">
        <p>
          By using PrivateFleet you agree to use the app only for authorized
          fleet work: logging loads, capturing damage photos, and coordinating
          with Safety/Admin as your role allows.
        </p>
        <h2 className="text-base font-semibold">Accounts & roles</h2>
        <p>
          Access is limited to authorized users. Drivers own their load data.
          Safety reviews damage referrals. Admins manage users and contact
          settings. Do not share credentials or attempt to access another
          driver’s private load information.
        </p>
        <h2 className="text-base font-semibold">Accurate records</h2>
        <p>
          Enter accurate load, mileage, and pay information. Completing a load
          requires ending mileage and pay amount. Off-day settings do not block
          overtime load logging.
        </p>
        <h2 className="text-base font-semibold">Photos & content</h2>
        <p>
          Upload only work-related damage photos and comments. Do not upload
          unlawful, harassing, or unrelated personal content.
        </p>
        <h2 className="text-base font-semibold">Availability</h2>
        <p>
          The app is provided as-is for fleet operations. Features may change.
          Draft legal pages may be updated; continued use after updates means
          you accept the revised terms when published.
        </p>
        <h2 className="text-base font-semibold">Contact</h2>
        <p>
          For account issues, feature ideas, or disputes, use Account → Contact
          to reach Admin.
        </p>
      </article>
    </main>
  );
}
