import React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export function Footer() {
  return (
    <footer className="w-full border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-sm font-semibold text-ink">VentureX</span>
          </Link>
          <p className="text-sm text-muted">Helping founders get ready to raise, and meet the right investors.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/#how-it-works" className="hover:text-ink">
            How it works
          </Link>
          <Link href="/register" className="hover:text-ink">
            Create an account
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-faint sm:px-6">© {new Date().getFullYear()} VentureX</p>
      </div>
    </footer>
  );
}
