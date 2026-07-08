import type { TagLite } from "../lib/queries";

/**
 * Small read-only tag chip: colored dot + name. Used on day-view drive cards
 * and anywhere else tags need a compact, non-interactive display.
 */
export function TagChip({ tag }: { tag: TagLite }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color ?? "#a3a3a3" }}
      />
      {tag.name}
    </span>
  );
}
