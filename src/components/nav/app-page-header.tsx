import { StateIcon } from "@/components/icons";
import { DriverId } from "@/components/ui/driver-id";
import {
  pageTitleClassName,
  pageTitleColorClassName,
} from "@/components/ui/page-title";
import { displayFirstOrFull } from "@/lib/profile-name";
import { usStateName } from "@/lib/us-states";
import type { Profile, UserRole } from "@/types/database";

type AppPageHeaderProps = {
  profile: Profile | null;
  role: UserRole;
};

function welcomeChipLabel(role: UserRole) {
  if (role === "safety") return "Welcome, Safety Team Member";
  if (role === "admin") return "Welcome, Admin";
  return "Welcome, Professional Driver";
}

/** Standard welcome header shown on every authenticated app page. */
export function AppPageHeader({ profile, role }: AppPageHeaderProps) {
  const named = displayFirstOrFull(profile?.full_name, "");
  const workState = profile?.work_state?.trim() || null;
  const workStateLabel = workState
    ? usStateName(workState.toUpperCase())
    : null;

  return (
    <header className="space-y-1.5 border-b border-border pb-3 pt-1">
      <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-brand ring-1 ring-accent/60">
        {welcomeChipLabel(role)}
      </span>
      <h1
        className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 ${pageTitleClassName}`}
      >
        <span>
          {named ? (
            named
          ) : profile?.driver_id ? (
            <>
              Driver <DriverId>{profile.driver_id}</DriverId>
            </>
          ) : (
            "there"
          )}
        </span>
        {workState ? (
          <span className="inline-flex items-center gap-1.5 font-normal text-muted-foreground">
            out of
            <StateIcon
              state={workState}
              className="size-6 shrink-0 text-brand"
              aria-label={workStateLabel ?? workState}
            />
            {workStateLabel ? (
              <span className={`font-bold ${pageTitleColorClassName}`}>
                {workStateLabel}
              </span>
            ) : null}
          </span>
        ) : null}
      </h1>
      {profile?.driver_id ? (
        <p className="text-sm text-muted-foreground">
          Driver ID <DriverId>{profile.driver_id}</DriverId>
        </p>
      ) : (
        <p className="text-sm capitalize text-muted-foreground">{role}</p>
      )}
    </header>
  );
}
