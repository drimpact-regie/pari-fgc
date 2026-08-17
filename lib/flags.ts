/** Code pays ISO 3166-1 alpha-2 -> emoji drapeau (offset Unicode "regional indicator"). */
export function countryCodeToFlagEmoji(code: string | null): string | null {
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  const codePoints = [...upper].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
