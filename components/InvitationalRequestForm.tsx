"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";

import { INVITATIONAL_FORMATS, INVITATIONAL_FORMAT_LABELS } from "@/lib/invitationalFormats";

type IdentMethod = "TWITCH" | "MANUAL";

export default function InvitationalRequestForm() {
  const { data: session, status } = useSession();

  const [identMethod, setIdentMethod] = useState<IdentMethod>("TWITCH");
  const [eventName, setEventName] = useState("");
  const [format, setFormat] = useState(INVITATIONAL_FORMATS[0]);
  const [twitchChannel, setTwitchChannel] = useState("");
  const [deadline, setDeadline] = useState("");
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/invitational/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        format,
        twitchChannel,
        deadline,
        identMethod,
        ...(identMethod === "MANUAL" ? { clientName, email } : {}),
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'envoi de la demande.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-6">
        <p className="text-sm font-semibold">Demande envoyée</p>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          Un admin va l&apos;examiner. {identMethod === "TWITCH"
            ? "Une fois confirmée, reconnectez-vous avec ce même compte Twitch pour accéder à la gestion de votre event."
            : "Une fois confirmée, vous recevrez un email avec le lien d'accès à la gestion de votre event."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 flex flex-col gap-4 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Demande d&apos;event Invitational / Prestataire</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Showmatch, exhibition, weekly invité... sans présence start.gg. Une fois votre demande
          confirmée par un admin, vous gérez vous-même votre event (import du fichier, joueurs,
          scores, overlay OBS).
        </p>
      </div>

      <label className="text-sm">
        Nom de l&apos;événement
        <input
          className="input mt-1"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          required
        />
      </label>

      <label className="text-sm">
        Format du tournoi
        <select className="input mt-1" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          {INVITATIONAL_FORMATS.map((f) => (
            <option key={f} value={f}>
              {INVITATIONAL_FORMAT_LABELS[f]}
            </option>
          ))}
        </select>
        <span className="text-xs mt-1 block" style={{ color: "var(--muted)" }}>
          Définitif une fois la demande confirmée — un changement de format nécessite ensuite un admin.
        </span>
      </label>

      <label className="text-sm">
        Chaîne Twitch
        <input
          className="input mt-1"
          value={twitchChannel}
          onChange={(e) => setTwitchChannel(e.target.value)}
          placeholder="mk_rza"
          required
        />
      </label>

      <label className="text-sm">
        Deadline
        <input
          type="date"
          className="input mt-1"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
        />
      </label>

      <div>
        <p className="text-sm font-medium mb-2">Identification</p>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className="btn"
            style={identMethod === "TWITCH" ? { background: "var(--accent)", color: "#fff" } : undefined}
            onClick={() => setIdentMethod("TWITCH")}
          >
            Connexion Twitch
          </button>
          <button
            type="button"
            className="btn"
            style={identMethod === "MANUAL" ? { background: "var(--accent)", color: "#fff" } : undefined}
            onClick={() => setIdentMethod("MANUAL")}
          >
            Formulaire manuel
          </button>
        </div>

        {identMethod === "TWITCH" ? (
          status === "authenticated" && session?.user ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Connecté en tant que <strong>{session.user.name}</strong>. Cette demande sera associée
              à ce compte.
            </p>
          ) : (
            <button
              type="button"
              className="btn w-full"
              style={{ background: "#9146FF", color: "#fff" }}
              onClick={() => signIn("twitch", { callbackUrl: "/invitational/request" })}
            >
              Se connecter avec Twitch
            </button>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <label className="text-sm">
              Nom Prénom du client
              <input
                className="input mt-1"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </label>
            <label className="text-sm">
              Email
              <input
                type="email"
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <span className="text-xs mt-1 block" style={{ color: "var(--muted)" }}>
                Sert à vous envoyer le lien d&apos;accès une fois la demande confirmée.
              </span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--lose)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || (identMethod === "TWITCH" && status !== "authenticated")}
      >
        {saving ? "Envoi..." : "Envoyer la demande"}
      </button>
    </form>
  );
}
