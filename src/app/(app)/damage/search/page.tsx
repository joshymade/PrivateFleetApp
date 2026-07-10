import { redirect } from "next/navigation";

/** Legacy scaffold route — Feed replaces damage search as a nav surface. */
export default function DamageSearchPage() {
  redirect("/feed");
}
