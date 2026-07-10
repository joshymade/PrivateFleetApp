import {
  routeSnippetParts,
  stopTypeNameClass,
  type LoadWithStopsLite,
} from "@/lib/loads/format";

type RouteSnippetProps = {
  load: LoadWithStopsLite;
  /** Color for ` → ` separators (plain fallback text inherits parent). */
  separatorClassName?: string;
};

export function RouteSnippet({
  load,
  separatorClassName = "text-muted-foreground",
}: RouteSnippetProps) {
  const parts = routeSnippetParts(load);

  return (
    <>
      {parts.map((part, i) => (
        <span key={`${part.kind}-${i}`}>
          {i > 0 ? (
            <span className={separatorClassName}>{" → "}</span>
          ) : null}
          {part.kind === "stop" ? (
            <span className={stopTypeNameClass(part.stopType)}>
              {part.name}
            </span>
          ) : (
            part.text
          )}
        </span>
      ))}
    </>
  );
}
