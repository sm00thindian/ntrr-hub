import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Treat unreachable auth (local Supabase stopped, network blip) as signed-out.
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (
      error &&
      (error.message?.includes("Refresh Token") || error.code === "refresh_token_not_found")
    ) {
      await supabase.auth.signOut();
      user = null;
    } else {
      user = data.user;
    }
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isInviteRoute = pathname.startsWith("/invite/");
  const isCronRoute = pathname.startsWith("/api/cron/");
  const isWebhookRoute = pathname.startsWith("/api/webhooks/");
  const isPublicRoute = pathname === "/" || isAuthRoute || isCronRoute || isWebhookRoute;

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (isInviteRoute) {
      redirectUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    redirectUrl.pathname = next && next.startsWith("/") ? next : "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}