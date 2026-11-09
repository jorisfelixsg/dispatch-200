import { logoSvg } from "@/lib/media/svg";
import { defaultOffers } from "@/lib/seed/offers";

/** Prerender the SVG for every fictitious merchant at build time. */
export function generateStaticParams() {
  return defaultOffers().map((o) => ({ id: String(o.id) }));
}

export async function GET(_req: Request, ctx: RouteContext<"/media/logo/[id]">) {
  const { id } = await ctx.params;
  const offer = defaultOffers().find((o) => o.id === Number(id));
  if (!offer) return new Response("Not found", { status: 404 });
  return new Response(logoSvg(offer.id, offer.merchantName), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
