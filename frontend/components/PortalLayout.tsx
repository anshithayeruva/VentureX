"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  MessagesSquare,
  Plus,
  Rocket,
  Search,
  Settings,
  Sliders,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { api, MeResponse } from "@/lib/api";
import { authClient, clearApiToken } from "@/lib/auth/client";
import { BrandMark } from "@/components/BrandMark";
import { buttonClass, cx } from "@/components/ui";

interface PortalLayoutProps {
  role: "FOUNDER" | "INVESTOR";
  children: React.ReactNode;
  /** Id of the nav item to highlight. */
  activeItem?: string;
  /** Optional hook for pages that also track the selection themselves. */
  onSelectItem?: (id: string) => void;
  /** Page name, used for the browser tab title. */
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export function PortalLayout({ role, children, activeItem, onSelectItem, title }: PortalLayoutProps) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api.getMe().then((user) => active && setMe(user)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.getUnreadNotificationCount(role).then((count) => active && setUnread(count));
    return () => {
      active = false;
    };
  }, [role, activeItem]);

  useEffect(() => {
    if (title) document.title = `${title} · VentureX`;
  }, [title]);

  const isFounder = role === "FOUNDER";
  const base = isFounder ? "/founder/dashboard" : "/investor/dashboard";

  const primary: NavItem[] = isFounder
    ? [
        { id: "overview", label: "Overview", href: base, icon: LayoutGrid },
        { id: "projects", label: "Projects", href: `${base}?tab=projects`, icon: Rocket },
        { id: "readiness", label: "Readiness", href: `${base}?tab=readiness`, icon: Sparkles },
        { id: "investors", label: "Investors", href: `${base}?tab=investors`, icon: Users },
        { id: "intros", label: "Intro requests", href: `${base}?tab=intros`, icon: Briefcase },
        { id: "dealrooms", label: "Deal rooms", href: "/dealroom?role=FOUNDER", icon: MessagesSquare },
      ]
    : [
        { id: "overview", label: "Overview", href: base, icon: LayoutGrid },
        { id: "recommended", label: "Recommended", href: `${base}?tab=recommended`, icon: Sparkles },
        { id: "browse", label: "Browse", href: `${base}?tab=browse`, icon: Search },
        { id: "interests", label: "My interests", href: `${base}?tab=interests`, icon: Heart },
        { id: "dealrooms", label: "Deal rooms", href: "/dealroom?role=INVESTOR", icon: MessagesSquare },
        { id: "preferences", label: "Criteria", href: "/investor/preferences", icon: Sliders },
      ];

  const secondary: NavItem[] = [
    { id: "notifications", label: "Notifications", href: `${base}?tab=notifications`, icon: Bell, count: unread },
    { id: "profile", label: "Profile", href: `${base}?tab=profile`, icon: User },
    { id: "settings", label: "Settings", href: `${base}?tab=settings`, icon: Settings },
  ];

  const initials =
    (me?.name || me?.email || "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  const signOut = async () => {
    await authClient.signOut();
    clearApiToken();
    router.replace("/login");
    router.refresh();
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const current = activeItem === item.id;
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={() => {
          setDrawerOpen(false);
          onSelectItem?.(item.id);
        }}
        aria-current={current ? "page" : undefined}
        className={cx(
          "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          current ? "bg-surface text-ink font-medium shadow-subtle ring-1 ring-line" : "text-muted hover:text-ink hover:bg-subtle"
        )}
      >
        <span className="flex items-center gap-2.5">
          <Icon className={cx("w-4 h-4", current ? "text-accent" : "text-faint")} />
          {item.label}
        </span>
        {!!item.count && (
          <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
            {item.count > 99 ? "99+" : item.count}
          </span>
        )}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={28} className="border-transparent" />
          <span className="text-[15px] font-semibold text-ink">VentureX</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden p-1 text-muted hover:text-ink"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="px-2.5 pb-2 text-xs text-faint">{isFounder ? "Founder workspace" : "Investor workspace"}</div>
        {isFounder && (
          <Link href="/founder/projects/new" className={buttonClass("primary", "w-full")} onClick={() => setDrawerOpen(false)}>
            <Plus className="w-4 h-4" />
            New project
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Workspace">
        {primary.map(renderItem)}
        <div className="my-3 border-t border-line" />
        {secondary.map(renderItem)}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{me?.name || me?.email || "Signed in"}</div>
            {me?.name && me?.email && <div className="truncate text-xs text-muted">{me.email}</div>}
          </div>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-faint hover:bg-subtle hover:text-ink"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink md:flex">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={26} className="border-transparent" />
          <span className="text-sm font-semibold">VentureX</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar: fixed on desktop, drawer on mobile */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 w-60 border-r border-line bg-canvas transition-transform duration-200",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <main className="min-w-0 flex-1 bg-surface md:min-h-screen md:border-l-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
