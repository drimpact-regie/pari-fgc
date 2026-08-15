"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Identifiants incorrects.");
      return;
    }

    router.push(from);
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto card p-6">
      <h1 className="text-xl font-semibold mb-4">Connexion</h1>
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
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          ou
        </span>
        <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
      </div>

      <button
        type="button"
        className="btn w-full"
        style={{ background: "#9146FF", color: "#fff" }}
        onClick={() => signIn("twitch", { callbackUrl: from })}
      >
        Se connecter avec Twitch
      </button>
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        Première connexion via Twitch ? Ton compte est créé automatiquement.
      </p>

      <p className="text-sm mt-4" style={{ color: "var(--muted)" }}>
        Pas encore de compte ?{" "}
        <Link href="/register" className="underline">
          S&apos;inscrire
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
