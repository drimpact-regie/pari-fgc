import { redirect } from "next/navigation";

/**
 * "Administration" = la liste des tournois à gérer (voir Nav.tsx) — ce
 * point d'entrée générique redirige simplement vers cette page, pour tout
 * lien existant/mis en favori vers "/admin" tel quel.
 */
export default function AdminHomePage() {
  redirect("/admin/tournaments");
}
