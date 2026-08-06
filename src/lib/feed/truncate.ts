/** Display-only truncation for feed issue/description snippets. */
export function truncateFeedDescription(
  text: string,
  maxChars = 50,
): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}
