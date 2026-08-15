import { redirect } from "next/navigation";

import { listTournaments } from "@/lib/tournaments";

export default async function LegacyPlayersRedirect() {
  const tournaments = await listTournaments();
  redirect(`/t/${tournaments[0].id}/players`);
}
