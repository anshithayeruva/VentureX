import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "VentureX — AI-Powered Founder & Investor Matching Platform",
  description:
    "Intelligently connect early-stage startup founders with relevant investors, syndicates, and capital opportunities via explainable AI readiness analysis and vector embeddings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-canvas text-ink flex flex-col antialiased selection:bg-accent-soft selection:text-accent">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
