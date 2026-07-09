import { redirect } from "next/navigation";

export default function HomePage() {
  // Auth wiring comes later; default to login for the bootstrap shell.
  redirect("/login");
}
