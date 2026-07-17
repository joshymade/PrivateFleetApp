import { BackLink } from "@/components/nav/back-link";
import { pageTitleClassName } from "@/components/ui/page-title";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 p-4 pb-8 pt-3">
      <BackLink href="/account/legal" aria-label="Back to Legal">
        Legal
      </BackLink>
      <div>
        <h1 className={pageTitleClassName}>Privacy Policy</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Draft — last updated July 16, 2026. Not legal advice.
        </p>
      </div>
      <article className="prose-sm space-y-4 text-sm text-foreground">
        <p>
          PrivateFleet is a private fleet operations app used by drivers,
          Safety, and Admin. This draft explains what information the app
          collects and how it is used.
        </p>
        <h2 className="text-base font-semibold">Account information</h2>
        <p>
          We store your email, display name, work state, role, and (for
          drivers) company Driver ID. Identity fields may be limited after
          setup; requests to change locked fields can be sent to Admin.
        </p>
        <h2 className="text-base font-semibold">Load information</h2>
        <p>
          Load numbers, routes, stops, trailer history, odometer readings, paid
          miles, earnings, off days, week-start preference, and ADP entries are
          private to the driver who owns them. Other drivers cannot view your
          loads.
        </p>
        <h2 className="text-base font-semibold">Damage reports & Safety</h2>
        <p>
          Damage photos and metadata (including optional GPS and timestamps)
          are stored so the fleet can review trailer/tractor damage. Photos are
          stored in cloud object storage; metadata lives in our database.
          Drivers may send reports to the Safety inbox. Safety and Admin can
          review referred items according to their role.
        </p>
        <h2 className="text-base font-semibold">Notifications & contact</h2>
        <p>
          In-app notifications track activity such as notices and comments.
          Contact forms may email Admin and store a copy of your message for
          follow-up.
        </p>
        <h2 className="text-base font-semibold">Your choices</h2>
        <p>
          You can update profile settings where allowed, sign out, and contact
          Admin about account or data questions. This draft will be replaced
          with final policy language when available.
        </p>
      </article>
    </main>
  );
}
