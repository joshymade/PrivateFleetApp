import { ContentDocPage } from "@/components/content/content-doc-page";
import { loadLegalDocument } from "@/lib/content/markdown";

export const metadata = { title: "Privacy Policy" };

export default async function PrivacyPolicyPage() {
  const doc = await loadLegalDocument("privacy");
  return <ContentDocPage doc={doc} />;
}
