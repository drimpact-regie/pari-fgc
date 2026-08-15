import { redirect } from "next/navigation";

import { listTournaments } from "@/lib/tournaments";

export default async function LegacyLeaderboardRedirect() {
  const tournaments = await listTournaments();
  redirect(`/t/${tournaments[0].id}/leaderboard`);
}
