"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, inviteCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Compte créé, mais la connexion automatique a échoué. Réessayez de vous connecter.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-1">Rejoindre le cercle</h1>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Places limitées — code d&apos;invitation requis.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          Nom d&apos;utilisateur
          <input
            className="input mt-1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="text-sm">
          Mot de passe
          <input
            className="input mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="text-sm">
          Code d&apos;invitation
          <input
            className="input mt-1"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>
      <p className="text-sm mt-4" style={{ color: "var(--muted)" }}>
        Déjà inscrit ?{" "}
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
      <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
        Ou inscris-toi directement via Twitch (sans code d&apos;invitation) depuis la{" "}
        <Link href="/login" className="underline">
          page de connexion
        </Link>
        .
      </p>
    </div>
  );
}
