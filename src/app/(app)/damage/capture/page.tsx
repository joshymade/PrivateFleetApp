import { redirect } from "next/navigation";

/** Legacy scaffold route — Report hub owns capture entry. */
export default function DamageCapturePage() {
  redirect("/report");
}
