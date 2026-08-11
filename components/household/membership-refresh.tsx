"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * After invite accept or first login, membership can briefly look empty while
 * the session / RLS context settles. Soft-refresh once so invitees (especially
 * self-advocates) land on their real board instead of "create household".
 */
export function MembershipRefresh() {
  const router = useRouter();
  const didRefresh = useRef(false);

  useEffect(() => {
    if (didRefresh.current) {
      return;
    }
    didRefresh.current = true;

    const timer = window.setTimeout(() => {
      router.refresh();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
