import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Venture X — AI-Powered Founder & Investor Matching Platform",
  description:
    "Intelligently connect early-stage startup founders with relevant investors, syndicates, and capital opportunities via explainable AI readiness analysis and vector embeddings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-cyan-500 selection:text-black`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
