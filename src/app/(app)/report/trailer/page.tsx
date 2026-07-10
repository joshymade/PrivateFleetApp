import { redirect } from "next/navigation";

/** Legacy route — unified capture lives on `/report`. */
export default function ReportTrailerRedirectPage() {
  redirect("/report?type=trailer");
}
