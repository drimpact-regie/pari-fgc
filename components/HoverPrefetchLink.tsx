"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

// Pour les longues listes de liens (ex. ~25 jeux d'un même tournoi) : ne
// précharge la page qu'au survol/toucher, plutôt que toutes celles visibles.
export default function HoverPrefetchLink({
  onMouseEnter,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
    />
  );
}
