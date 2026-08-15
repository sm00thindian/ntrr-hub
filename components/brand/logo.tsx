import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  /**
   * `full` — icon + Hub + platform tagline (headers)
   * `compact` — icon + Hub only (tight chrome)
   */
  variant?: "full" | "compact";
};

const iconSizes = {
  sm: 24,
  md: 28,
  lg: 32,
} as const;

const productText = {
  sm: "text-sm",
  md: "text-[0.9375rem] sm:text-base",
  lg: "text-base sm:text-lg",
} as const;

const taglineText = {
  sm: "text-[10px]",
  md: "text-[11px] sm:text-xs",
  lg: "text-xs",
} as const;

/**
 * Hub header mark: [N monogram] Hub · Not The Runaround
 * Platform tagline stays sentence case; product name is primary.
 */
export function Logo({
  className,
  href = "/dashboard",
  size = "md",
  variant = "full",
}: LogoProps) {
  const px = iconSizes[size];
  const content = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2",
        className,
      )}
    >
      <Image
        src="/brand/ntrr-app-icon-125.png"
        alt=""
        width={px}
        height={px}
        className="shrink-0"
        style={{ width: px, height: px }}
        priority
      />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block font-semibold tracking-tight text-foreground",
            productText[size],
          )}
        >
          Hub
        </span>
        {variant === "full" ? (
          <span
            className={cn(
              "text-brand block font-normal tracking-wide",
              taglineText[size],
            )}
          >
            Not The Runaround
          </span>
        ) : null}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0" aria-label="Hub home">
        {content}
      </Link>
    );
  }

  return content;
}
