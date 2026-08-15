"use client";

import { useState } from "react";

export default function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors du changement de mot de passe.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="card p-4">
      <p className="text-sm font-semibold mb-1">
        {hasPassword ? "Changer mon mot de passe" : "Définir un mot de passe"}
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
        {hasPassword
          ? "Permet aussi de te connecter par identifiants en plus de Twitch."
          : "Ton compte a été créé via Twitch et n'a pas encore de mot de passe — en définir un permet de te connecter aussi par identifiants."}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-xs">
        {hasPassword && (
          <label className="text-sm">
            Mot de passe actuel
            <input
              type="password"
              className="input mt-1"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        )}
        <label className="text-sm">
          Nouveau mot de passe
          <input
            type="password"
            className="input mt-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="text-sm">
          Confirmer le nouveau mot de passe
          <input
            type="password"
            className="input mt-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "var(--lose)" }}>
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm" style={{ color: "var(--win)" }}>
            Mot de passe mis à jour.
          </p>
        )}
        <button type="submit" className="btn btn-primary self-start" disabled={saving}>
          {saving ? "..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
