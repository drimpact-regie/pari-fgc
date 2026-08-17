import Nav from "@/components/Nav";
import AuthProvider from "@/components/AuthProvider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Nav />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">{children}</main>
      <footer className="text-center text-xs py-6" style={{ color: "var(--muted)" }}>
        Données fournies par l&apos;API start.gg
      </footer>
    </AuthProvider>
  );
}
