import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  /** Show “Hub” product wordmark (default) or compact “H” mark */
  mark?: "word" | "compact";
};

const sizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export function Logo({
  className,
  href = "/dashboard",
  size = "md",
  mark = "word",
}: LogoProps) {
  const content = (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tracking-tight text-foreground",
        sizes[size],
        className,
      )}
    >
      {mark === "compact" ? "H" : "Hub"}
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
