"use client";

import { useState } from "react";
import { ContactAdminModal } from "@/components/profile/contact-admin-modal";

type Props = {
  driverId: string | null;
  className?: string;
};

export function ContactAdminButton({ driverId, className }: Props) {
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
      {open ? (
        <ContactAdminModal
          onClose={() => setOpen(false)}
          driverId={driverId}
        />
      ) : null}
    </>
  );
}
