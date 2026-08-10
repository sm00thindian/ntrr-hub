import { cn } from "@/lib/utils";

type AppIconProps = {
  className?: string;
  size?: number;
};

/** Simple product mark — zinc square + H, matches platform calm aesthetic */
export function AppIcon({ className, size = 32 }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Hub"
      className={cn("shrink-0", className)}
    >
      <rect width="64" height="64" rx="14" className="fill-zinc-900 dark:fill-zinc-100" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        className="fill-white dark:fill-zinc-900"
        fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
        fontSize="28"
        fontWeight="600"
      >
        H
      </text>
    </svg>
  );
}
