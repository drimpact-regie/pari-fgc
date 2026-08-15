import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

/**
 * Authentification — phase 1 : cercle fermé d'environ 30 personnes,
 * identifiants nom d'utilisateur / mot de passe, inscription protégée par
 * un code d'invitation (voir /api/register).
 *
 * Phase 2 (évolution future, pas encore activée) : ajouter un provider
 * OAuth Discord (`next-auth/providers/discord`, variables d'env
 * AUTH_DISCORD_ID / AUTH_DISCORD_SECRET) et/ou un provider OAuth custom
 * pour start.gg dans le tableau `providers` ci-dessous. Le modèle Prisma
 * `User` a déjà les colonnes `discordId` / `startggId` prêtes pour ça —
 * voir README, section "Authentification : évolutions futures".
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
  ],
  callbacks: {
    jwt({ token, user }) {
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
