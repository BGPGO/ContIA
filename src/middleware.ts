import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  // Skip auth when Supabase is not configured (mock mode)
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  // Rotas públicas — nunca bloqueiam
  if (
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/auth/") ||
    path.startsWith("/conexoes") ||
    path.startsWith("/api/instagram") ||
    path.startsWith("/api/video")
  ) {
    return NextResponse.next();
  }

  // Rotas protegidas — tentar autenticar com timeout
  try {
    const { updateSession } = await import("@/lib/supabase/middleware");

    const result = await Promise.race([
      updateSession(request),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    // Timeout ou erro — deixa passar
    if (!result) {
      return NextResponse.next();
    }

    const { user, supabaseResponse } = result;

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/video|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
