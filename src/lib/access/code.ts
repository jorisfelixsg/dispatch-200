// Optional demo access code (spec section 7). If DEMO_ACCESS_CODE is not set, access is free.

export const ACCESS_COOKIE = "dispatch200_access";

/** Cookie value derived from the code, so the code itself is never stored in the browser. */
export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`dispatch200:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
