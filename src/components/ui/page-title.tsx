/** Brand blue (light) / gold accent (dark) for titles and key labels. */
export const pageTitleColorClassName = "text-brand dark:text-accent";

/** Shared style for page-level H1 titles. */
export const pageTitleClassName =
  `text-2xl font-semibold tracking-tight ${pageTitleColorClassName}`;

/**
 * Section / card headings — same brand↔accent pairing as page titles
 * so light and dark both show the fleet colors without one-off classes.
 */
export const sectionHeadingColorClassName = pageTitleColorClassName;

export const sectionHeadingClassName = `font-semibold ${sectionHeadingColorClassName}`;
