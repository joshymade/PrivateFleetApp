import { LoginForm } from "@/components/auth/login-form";
import { pageTitleClassName } from "@/components/ui/page-title";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className={pageTitleClassName}>Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          PrivateFleet — email and password.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
