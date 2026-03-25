import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Skip auth when Supabase is not configured (mock mode)
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const { user, supabaseResponse } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // Auth pages — redirect to dashboard if already logged in
  if (path.startsWith("/login") || path.startsWith("/register")) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Protected pages — redirect to login if not authenticated
  if (!user && !path.startsWith("/auth/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
