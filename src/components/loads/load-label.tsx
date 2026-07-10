import { driverIdClassName } from "@/components/ui/driver-id";

/** "Load " + brand-styled `#number` (same treatment as DriverId). */
export function LoadLabel({ loadNumber }: { loadNumber: string }) {
  return (
    <>
      Load <span className={driverIdClassName}>#{loadNumber}</span>
    </>
  );
}
