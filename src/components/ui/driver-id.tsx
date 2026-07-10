import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** Shared style for company Driver ID values (bold + signature brand blue). */
export const driverIdClassName = "font-bold text-brand";

type DriverIdProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  children: ReactNode;
};

/**
 * Renders a Driver ID value with the app-standard brand treatment.
 * Labels like "Driver ID" stay muted; wrap only the ID itself.
 */
export function DriverId({ children, className, ...props }: DriverIdProps) {
  return (
    <span
      className={
        className ? `${driverIdClassName} ${className}` : driverIdClassName
      }
      {...props}
    >
      {children}
    </span>
  );
}
