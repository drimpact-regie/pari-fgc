import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin/tournaments", label: "Tournois" },
  { href: "/admin/invitational", label: "Invitational / Prestataire" },
  { href: "/admin/characters", label: "Personnages" },
  { href: "/admin/parry", label: "Le Pari du Parry" },
  { href: "/admin/ex", label: "Soldes Ex" },
] as const;

export default function AdminMenu() {
  return (
    <details className="relative">
      <summary
        className="hover:opacity-80 cursor-pointer list-none"
        style={{ color: "var(--accent)" }}
      >
        Admin ▾
      </summary>
      <div
        className="absolute right-0 mt-2 rounded-md overflow-hidden z-20"
        style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
      >
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block px-4 py-2 text-sm whitespace-nowrap hover:opacity-80"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
