import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access/code";

export async function proxy(request: NextRequest) {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && cookie === (await accessToken(code))) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Code d'accès requis" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|access|api/access).*)"],
};
