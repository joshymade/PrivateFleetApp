import { ContentDocPage } from "@/components/content/content-doc-page";
import { loadLegalDocument } from "@/lib/content/markdown";

export const metadata = { title: "Terms of Service" };

export default async function TermsOfServicePage() {
  const doc = await loadLegalDocument("terms");
  return <ContentDocPage doc={doc} />;
}
