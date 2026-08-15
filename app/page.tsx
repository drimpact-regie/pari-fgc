import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listTournaments } from "@/lib/tournaments";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="card p-6">
        <p>
          Connecte-toi ou inscris-toi pour parier sur les matchs du bracket.
        </p>
      </div>
    );
  }

  const tournaments = await listTournaments();
  redirect(`/t/${tournaments[0].id}/matches`);
}
