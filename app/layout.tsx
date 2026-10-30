import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CS2 Stats",
  description: "Estatísticas das nossas partidas de Counter-Strike 2",
};

const nav = [
  { href: "/", label: "Visão geral" },
  { href: "/matches", label: "Partidas" },
  { href: "/players", label: "Jogadores" },
  { href: "/comparar", label: "Comparar" },
  { href: "/hall", label: "Hall da fama" },
  { href: "/upload", label: "Enviar demo" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";

  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-md bg-win/15 text-[13px] font-bold text-win">
                CS
              </span>
              CS2 Stats
            </Link>
            <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/conta"
              className="rounded-md px-2.5 py-1.5 text-sm text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-100"
            >
              Minha conta
            </Link>
            <Link
              href="/admin"
              className="rounded-md px-2.5 py-1.5 text-sm text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-100"
            >
              Admin
            </Link>
            <a
              href="https://github.com/allanhal/cs2stats"
              target="_blank"
              rel="noreferrer"
              title="Código no GitHub"
              aria-label="Código no GitHub"
              className="grid size-8 place-items-center rounded-md text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-100"
            >
              <GitHubMark />
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 sm:px-6 sm:py-9">
          {children}
        </main>
        <footer className="border-t border-ink-700/70 px-4 py-5 text-center text-xs text-fog-500 sm:px-6">
          Só os números das demos ficam guardados; o arquivo é descartado.
          {commit ? (
            <>
              {" · "}
              <a
                href={`https://github.com/allanhal/cs2stats/commit/${commit}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono transition-colors hover:text-fog-100"
              >
                {commit.slice(0, 7)}
              </a>
            </>
          ) : null}
        </footer>
      </body>
    </html>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-[18px] fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-2.92-.88-2.92-2.9 0-.58.21-1.05.54-1.42-.05-.13-.24-.67.05-1.39 0 0 .44-.14 1.45.54a4.9 4.9 0 0 1 1.32-.18c.45 0 .9.06 1.32.18 1.01-.69 1.45-.54 1.45-.54.29.72.1 1.26.05 1.39.33.37.54.84.54 1.42 0 2.03-1.15 2.7-2.93 2.9.3.26.56.76.56 1.54 0 1.11-.01 2.02-.01 2.3 0 .21.15.46.55.38A7.99 7.99 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
