import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request via middleware.
 *
 * Protected routes (/dashboard) redirect unauthenticated users to /login.
 * Editor routes (/editor/[projectId]) allow unauthenticated access through --
 * the editor layout server component checks project visibility (public/private).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: Use getUser() not getSession() for server-side auth validation.
  // getSession() reads from local storage/cookies without JWT verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow public routes through without auth.
  // "/" is included because the dashboard layout has its own auth check
  // (redirect to /login if no user). Letting "/" through the middleware
  // avoids a race condition where the auth cookie hasn't been flushed
  // to the browser's cookie store after anonymous sign-in.
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback")
  ) {
    return supabaseResponse;
  }

  // PROJ-03: Editor routes allow unauthenticated access --
  // the layout server component handles public/private project checks
  if (pathname.startsWith("/editor/")) {
    return supabaseResponse;
  }

  // Protected routes: redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
