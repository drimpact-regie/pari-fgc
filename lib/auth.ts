import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Twitch from "next-auth/providers/twitch";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { ensureUserByTwitchId } from "@/lib/users";

/**
 * Authentification — cercle fermé d'environ 30 personnes.
 *
 * Deux façons de se connecter :
 * - Identifiants nom d'utilisateur / mot de passe, inscription protégée
 *   par un code d'invitation (voir /api/register).
 * - Twitch (OAuth) : pas d'adapter base de données ici (session JWT
 *   simple, comme pour les identifiants), donc la résolution/création du
 *   compte associé se fait "à la main" dans le callback jwt ci-dessous,
 *   par twitchId — même logique que la création de compte à la volée
 *   pour le pari via chat (lib/users.ts). Se connecter via Twitch crée
 *   donc le compte au passage s'il n'existe pas encore (pas de code
 *   d'invitation requis pour cette voie, comme pour le chat).
 *
 * Phase future (pas encore activée) : ajouter un provider OAuth Discord
 * (`next-auth/providers/discord`, variables d'env AUTH_DISCORD_ID /
 * AUTH_DISCORD_SECRET) et/ou un provider OAuth custom pour start.gg dans
 * le tableau `providers` ci-dessous. Le modèle Prisma `User` a déjà les
 * colonnes `discordId` / `startggId` prêtes pour ça.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Identifiants",
      credentials: {
        username: { label: "Nom d'utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.username, isAdmin: user.isAdmin };
      },
    }),
    Twitch({
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "twitch" && account.providerAccountId) {
        const dbUser = await ensureUserByTwitchId(
          account.providerAccountId,
          user?.name || `twitch-${account.providerAccountId}`,
        );
        token.id = dbUser.id;
        token.isAdmin = dbUser.isAdmin;
        return token;
      }
      if (user) {
        token.id = user.id!;
        token.isAdmin = user.isAdmin ?? false;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.isAdmin = token.isAdmin;
      return session;
    },
  },
});
