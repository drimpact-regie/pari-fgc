import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getStandings } from "@/lib/startgg";
import { migrateExBalances } from "@/lib/exMigration";

/**
 * Migration ponctuelle (idempotente, peut être relancée) : convertit les
 * gains déjà accumulés par chaque utilisateur (paris classiques, MVC,
 * reset de bracket, Top 8) en solde Ex de départ, sans toucher aux
 * comptes sans historique (qui gardent leur solde par défaut).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const results = await migrateExBalances(getStandings);
  const changed = results.filter((r) => r.changed);

  return NextResponse.json({
    usersProcessed: results.length,
    usersChanged: changed.length,
    changed,
  });
}
