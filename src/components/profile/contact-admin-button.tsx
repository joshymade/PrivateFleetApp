"use client";

import { useState } from "react";
import { ContactAdminModal } from "@/components/profile/contact-admin-modal";

type Props = {
  defaultEmail: string;
  driverId: string | null;
  className?: string;
};

export function ContactAdminButton({
  defaultEmail,
  driverId,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "min-h-11 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        }
      >
        Contact Admin
      </button>
      <ContactAdminModal
        open={open}
        onClose={() => setOpen(false)}
        defaultEmail={defaultEmail}
        driverId={driverId}
      />
    </>
  );
}
