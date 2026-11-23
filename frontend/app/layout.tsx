import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "VentureX — Get ready to raise",
  description:
    "Private AI feedback on your pitch, and introductions to investors who fit.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Render per request: the Content-Security-Policy nonce (set in proxy.ts) is new every time,
  // and a page built ahead of time could not carry it.
  await connection();
  return (
    <html
      lang="en"
      className="scroll-smooth"
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Newsreader:opsz,wght@6..72,400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-canvas text-ink flex flex-col antialiased selection:bg-accent-soft selection:text-accent">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
