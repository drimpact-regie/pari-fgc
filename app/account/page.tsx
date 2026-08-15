import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string; linkError?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?from=%2Faccount");
  }

  const { linked, linkError } = await searchParams;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const isLinked = Boolean(user?.twitchId);

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-xl font-semibold">Mon compte</h1>

      {linked && (
        <div className="card p-4 text-sm" style={{ color: "var(--win)" }}>
          Compte Twitch lié avec succès. Tu peux maintenant parier depuis le chat.
        </div>
      )}
      {linkError && (
        <div className="card p-4 text-sm" style={{ color: "var(--lose)" }}>
          {decodeURIComponent(linkError)}
        </div>
      )}

      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Compte Twitch</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {isLinked
              ? "Lié — tu peux parier depuis le chat Twitch avec !bet mvc et !bet reset."
              : "Non lié — requis pour parier depuis le chat Twitch (Le Pari du Parry)."}
          </p>
        </div>
        {!isLinked && (
          <a href="/api/twitch/link/connect" className="btn btn-primary text-xs whitespace-nowrap">
            Lier mon compte Twitch
          </a>
        )}
      </div>

      <ChangePasswordForm hasPassword={Boolean(user?.passwordHash)} />
    </div>
  );
}
