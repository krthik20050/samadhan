import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Grievance MVP" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-base text-neutral-900">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-3 focus:font-medium"
        >
          Skip to content
        </a>
        <header className="border-b bg-white">
          <nav aria-label="Main" className="mx-auto flex max-w-3xl gap-1 p-2 text-base">
            {[
              ["/", "Home"],
              ["/complain", "File complaint"],
              ["/track", "Track"],
              ["/dashboard", "Dashboard"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="min-h-[44px] px-3 py-2.5">
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="content" className="mx-auto max-w-3xl p-4">
          {children}
        </main>
      </body>
    </html>
  );
}
