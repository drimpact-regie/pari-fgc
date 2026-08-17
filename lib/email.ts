/**
 * Envoi d'email minimal, sans dépendance ajoutée au projet — utilise l'API
 * HTTP de Resend (https://resend.com) directement en fetch. Configuré via
 * RESEND_API_KEY + EMAIL_FROM (voir .env.example). Si ces variables sont
 * absentes (pas encore configuré en prod, ou en dev local), l'envoi est un
 * no-op journalisé plutôt qu'une erreur bloquante : l'appelant (voir
 * lib/invitationalRequests.ts) doit rester capable de confirmer une demande
 * même sans email configuré, et affiche alors le lien d'accès directement
 * dans l'admin pour transmission manuelle.
 */

export class EmailSendError extends Error {}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn(
      `[email] RESEND_API_KEY/EMAIL_FROM non configurés — email à ${message.to} non envoyé ("${message.subject}").`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new EmailSendError(`Envoi d'email échoué (${res.status}) : ${text}`);
  }
}

/**
 * Email envoyé au prestataire identifié manuellement (sans compte Twitch)
 * une fois sa demande confirmée — contient le lien d'accès "magique" à sa
 * page de gestion (voir /partner/invitational/[eventId]/access dans
 * app/api/partner/invitational/events/[eventId]/claim/route.ts, qui pose le
 * cookie d'accès à la première visite du lien).
 */
export function buildPartnerAccessEmail(input: {
  to: string;
  eventName: string;
  accessUrl: string;
}): EmailMessage {
  const subject = `Accès à votre event "${input.eventName}" sur Impact'O Bet`;
  const text = [
    `Votre demande d'event "${input.eventName}" a été confirmée.`,
    "",
    `Gérez votre event (joueurs, scores, statuts, overlay) depuis ce lien :`,
    input.accessUrl,
    "",
    "Ce lien est personnel, ne le partagez pas.",
  ].join("\n");
  const html = `
    <p>Votre demande d'event <strong>${escapeHtml(input.eventName)}</strong> a été confirmée.</p>
    <p>Gérez votre event (joueurs, scores, statuts, overlay) depuis ce lien :</p>
    <p><a href="${escapeHtml(input.accessUrl)}">${escapeHtml(input.accessUrl)}</a></p>
    <p>Ce lien est personnel, ne le partagez pas.</p>
  `.trim();

  return { to: input.to, subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
