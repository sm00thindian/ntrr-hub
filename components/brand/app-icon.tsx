import Image from "next/image";

import { cn } from "@/lib/utils";

type AppIconProps = {
  className?: string;
  size?: number;
};

/** Platform N monogram — shared NTRR brand mark */
export function AppIcon({ className, size = 32 }: AppIconProps) {
  return (
    <Image
      src="/brand/ntrr-app-icon-125.png"
      alt="NTRR"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority
    />
  );
}
