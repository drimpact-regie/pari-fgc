import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import AuthProvider from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pari FGC",
  description: "Paris entre amis sur les brackets start.gg",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Nav />
          <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="text-center text-xs py-6" style={{ color: "var(--muted)" }}>
            Données fournies par l&apos;API start.gg
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
