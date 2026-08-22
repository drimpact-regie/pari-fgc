import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { canonicalHostFor, classifyPath } from "@/lib/domainRouting";
import { mintBridgeToken } from "@/lib/ssoBridge";

/**
 * Point d'entrée du pont SSO : appelé par bridgeHref() quand un lien
 * interne pointe vers l'autre domaine. Sans session active, inutile de
 * ponter quoi que ce soit — on redirige directement vers la destination
 * sur le bon domaine, la page cible gérera elle-même le login si besoin
 * (comportement identique à un lien direct).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/";
  const explicitDomain = url.searchParams.get("domain");

  const targetDomain =
    explicitDomain === "parieur" || explicitDomain === "streamer"
      ? explicitDomain
      : classifyPath(next) ?? "parieur";
  const targetHost = canonicalHostFor(targetDomain);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(next, `https://${targetHost}`));
  }

  const token = await mintBridgeToken(session.user.id);
  const completeUrl = new URL("/api/auth/bridge/complete", `https://${targetHost}`);
  completeUrl.searchParams.set("token", token);
  completeUrl.searchParams.set("next", next);

  return NextResponse.redirect(completeUrl);
}
