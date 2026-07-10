import { redirect } from "next/navigation";

/** Legacy scaffold route — Home is the primary surface. */
export default function DashboardPage() {
  redirect("/home");
}
