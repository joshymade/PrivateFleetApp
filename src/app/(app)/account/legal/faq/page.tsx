import { ContentDocPage } from "@/components/content/content-doc-page";
import { loadFaqDocument } from "@/lib/content/markdown";

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const doc = await loadFaqDocument();
  return <ContentDocPage doc={doc} />;
}
