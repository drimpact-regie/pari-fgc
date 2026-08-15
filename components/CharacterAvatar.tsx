interface Character {
  name: string;
  imageUrl: string | null;
}

/** Couleur déterministe (pas d'aléatoire) dérivée du nom, pour l'avatar de repli sans image. */
export function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 55%, 32%)`;
}

export default function CharacterAvatar({
  character,
  size = 48,
}: {
  character: Character;
  size?: number;
}) {
  if (character.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={character.imageUrl}
        alt=""
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-md flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: fallbackColor(character.name) }}
    >
      {character.name.charAt(0).toUpperCase()}
    </div>
  );
}
