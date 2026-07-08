import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: {
    label: string;
    href: string;
    icon?: ButtonProps["icon"];
  };
  className?: string;
}

/**
 * Shared empty/hint state used by day view, search (hint + no-results),
 * journeys list, charges (empty month), etc.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700 ${className}`.trim()}
    >
      <Icon
        aria-hidden
        size={28}
        className="mx-auto text-neutral-400 dark:text-neutral-600"
        strokeWidth={1.75}
      />
      <p className="mt-3 text-base font-medium text-neutral-700 dark:text-neutral-300">
        {title}
      </p>
      {hint && (
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
      {action && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button href={action.href} variant="primary" icon={action.icon}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
