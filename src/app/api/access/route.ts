import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access/code";

export async function POST(request: Request) {
  const expected = process.env.DEMO_ACCESS_CODE;
  const form = await request.formData();
  const submitted = String(form.get("code") ?? "").trim();
  const base = new URL(request.url);

  if (!expected) return NextResponse.redirect(new URL("/", base), 303);
  if (submitted !== expected) return NextResponse.redirect(new URL("/access?error=1", base), 303);

  const res = NextResponse.redirect(new URL("/", base), 303);
  res.cookies.set(ACCESS_COOKIE, await accessToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: base.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
