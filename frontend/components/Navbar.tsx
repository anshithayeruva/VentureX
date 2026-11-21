"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { buttonClass } from "@/components/ui";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#founders", label: "For founders" },
  { href: "/#investors", label: "For investors" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={30} />
            <span className="text-base font-semibold text-ink">VentureX</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonClass("ghost")}>
            Sign in
          </Link>
          <Link href="/register" className={buttonClass("primary")}>
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-muted hover:bg-subtle hover:text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="space-y-1 border-t border-line bg-surface px-4 pb-5 pt-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-subtle"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3">
            <Link href="/login" onClick={() => setOpen(false)} className={buttonClass("secondary", "flex-1")}>
              Sign in
            </Link>
            <Link href="/register" onClick={() => setOpen(false)} className={buttonClass("primary", "flex-1")}>
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
