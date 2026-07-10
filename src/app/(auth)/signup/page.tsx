import { SignupForm } from "@/components/auth/signup-form";
import { pageTitleClassName } from "@/components/ui/page-title";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className={pageTitleClassName}>Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drivers need a unique company Driver ID. It is stored on your profile
          at signup.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
