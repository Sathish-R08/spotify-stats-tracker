import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This ensures the Supabase session is refreshed on every
     * server-rendered request.
     */
    "/((?!_next/static|_next/image|favicon|site.webmanifest|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
