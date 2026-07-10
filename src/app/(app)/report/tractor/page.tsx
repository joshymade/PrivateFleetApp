import { redirect } from "next/navigation";

/** Legacy route — unified capture lives on `/report`. */
export default function ReportTractorRedirectPage() {
  redirect("/report?type=tractor");
}
