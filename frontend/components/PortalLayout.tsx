"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  FileText,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  MessagesSquare,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api, MeResponse } from "@/lib/api";
import { applyServerPreferences, getDisplayPrefs } from "@/lib/displayPrefs";
import { authClient, clearApiToken } from "@/lib/auth/client";
import { BrandMark } from "@/components/BrandMark";
import { cx } from "@/components/ui";
import { InvitationsBanner } from "@/components/teams";
import { InvestorVerificationBanner } from "@/components/verification";

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
  /** Full-width page without the sidebar; the workspace sections move to a compact top bar. */
  wide?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function PortalLayout({ role, children, activeItem, onSelectItem, title, wide = false }: PortalLayoutProps) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Starts from the locally cached preference so the first paint matches; the server copy follows.
  const [showBadge, setShowBadge] = useState(() => getDisplayPrefs().showUnreadBadge);

  useEffect(() => {
    let active = true;
    api
      .getMySettings()
      .then((s) => {
        if (!active) return;
        applyServerPreferences(s.settings.preferences);
        setShowBadge(getDisplayPrefs().showUnreadBadge);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
        { id: "investors", label: "Find investors", href: "/founder/investors", icon: Users },
        { id: "intros", label: "Intro requests", href: `${base}?tab=intros`, icon: Briefcase },
        { id: "dealrooms", label: "Deal rooms", href: "/dealroom?role=FOUNDER", icon: MessagesSquare },
        { id: "updates", label: "Investor updates", href: "/founder/updates", icon: FileText },
      ]
    : [
        { id: "overview", label: "Overview", href: base, icon: LayoutGrid },
        { id: "discover", label: "Discover", href: "/investor/discover", icon: Search },
        { id: "dealflow", label: "Deal Flow", href: "/investor/deal-flow", icon: MessagesSquare },
        { id: "portfolio", label: "Portfolio & Finances", href: "/investor/portfolio", icon: Wallet },
        { id: "updates", label: "Company updates", href: "/investor/updates", icon: Inbox },
        { id: "firm", label: "Firm", href: "/investor/firm", icon: Building2 },
        { id: "preferences", label: "Criteria", href: "/investor/preferences", icon: Sliders },
        { id: "verification", label: "Verification", href: "/investor/verification", icon: ShieldCheck },
      ];

  const initials =
    (me?.name || me?.email || "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  const signOut = async () => {
    // The session lives with the sign-in service (Neon Auth). If it can't be reached, retry once,
    // then say so: leaving the page would look signed out while the session is still active.
    const attempt = async () => {
      const res = (await authClient.signOut()) as { error?: { message?: string } | null } | undefined;
      if (res?.error) throw new Error(res.error.message || "Sign-out failed");
    };
    try {
      try {
        await attempt();
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
        await attempt();
      }
    } catch {
      window.alert("We couldn't reach the sign-in service to sign you out. Check your connection and try again in a moment.");
      return;
    }
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
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
          current
            ? "bg-sidebar-active text-white font-medium shadow-[inset_2px_0_0_var(--color-sidebar-icon)]"
            : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
        )}
      >
        <Icon className={cx("w-4 h-4", current ? "text-sidebar-icon" : "text-sidebar-faint")} />
        {item.label}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={28} className="border-transparent" />
          <span className="font-serif text-[17px] font-medium tracking-tight text-white">VentureX</span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden p-1 text-sidebar-text hover:text-white"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="px-2.5 pb-2 text-xs uppercase tracking-[0.08em] text-sidebar-faint">
          {isFounder ? "Founder workspace" : "Investor workspace"}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Workspace">
        {primary.map(renderItem)}
      </nav>
    </div>
  );

  const notificationsActive = activeItem === "notifications";

  return (
    <div className="min-h-screen bg-canvas text-ink md:flex">
      {/* Sidebar: sticky on desktop, drawer on mobile */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 w-60 border-r border-sidebar-line bg-sidebar transition-transform duration-200",
          !wide && "md:sticky md:top-0 md:h-screen md:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>
      {drawerOpen && (
        <div className={cx("fixed inset-0 z-40 bg-ink/40", !wide && "md:hidden")} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-canvas md:min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-8">
          <div className={cx("flex items-center gap-2", wide ? "lg:hidden" : "md:hidden")}>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-1.5 rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size={24} className="border-transparent" />
              <span className="font-serif text-base font-medium">VentureX</span>
            </Link>
          </div>
          {wide ? (
            <div className="hidden min-w-0 items-center gap-6 lg:flex">
              <Link href="/" className="flex shrink-0 items-center gap-2">
                <BrandMark size={26} className="border-transparent" />
                <span className="font-serif text-[17px] font-medium">VentureX</span>
              </Link>
              <nav aria-label="Workspace" className="flex items-center gap-1 overflow-x-auto">
                {primary.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={activeItem === item.id ? "page" : undefined}
                    className={cx(
                      "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      activeItem === item.id ? "bg-sidebar text-white" : "text-ink-2 hover:bg-subtle hover:text-ink"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          ) : (
            <div className="hidden md:block" />
          )}

          <div className="flex items-center gap-1.5">
            <Link
              href={`${base}?tab=notifications`}
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              title="Notifications"
              aria-current={notificationsActive ? "page" : undefined}
              className={cx(
                "relative rounded-lg p-2 transition-colors",
                notificationsActive ? "bg-subtle text-ink" : "text-muted hover:bg-subtle hover:text-ink"
              )}
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && showBadge && (
                <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-canvas">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <AccountMenu
              initials={initials}
              name={me?.name}
              email={me?.email}
              workspace={isFounder ? "Founder" : "Investor"}
              profileHref={isFounder ? "/founder/profile" : "/investor/profile"}
              settingsHref={isFounder ? "/founder/settings" : "/investor/settings"}
              isAdmin={!!me?.is_admin}
              onSignOut={signOut}
            />
          </div>
        </header>

        <main className="flex-1">
          <div className={cx("mx-auto w-full px-4 py-6 sm:px-8 sm:py-10", wide ? "max-w-[1400px]" : "max-w-6xl")}>
            <InvitationsBanner />
            {activeItem !== "verification" && <InvestorVerificationBanner me={me} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Avatar button with a small menu: who is signed in, Profile, Settings, Sign out. */
function AccountMenu({
  initials,
  name,
  email,
  workspace,
  profileHref,
  settingsHref,
  isAdmin,
  onSignOut,
}: {
  initials: string;
  name?: string | null;
  email?: string | null;
  workspace: string;
  profileHref: string;
  settingsHref: string;
  isAdmin?: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1 rounded-full p-0.5 hover:bg-subtle"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initials}
        </span>
        <ChevronDown className={cx("h-4 w-4 text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-elevated">
          <div className="px-2.5 py-2">
            <div className="truncate text-sm font-medium text-ink">{name || email || "Signed in"}</div>
            {name && email && <div className="truncate text-xs text-muted">{email}</div>}
            <div className="mt-1 text-xs text-faint">{workspace} workspace</div>
          </div>
          <div className="my-1 border-t border-line" />
          <Link role="menuitem" href={profileHref} onClick={() => setOpen(false)} className={itemClass}>
            <User className="h-4 w-4 text-faint" />
            Profile
          </Link>
          <Link role="menuitem" href={settingsHref} onClick={() => setOpen(false)} className={itemClass}>
            <Settings className="h-4 w-4 text-faint" />
            Settings
          </Link>
          <div className="my-1 border-t border-line" />
          {isAdmin && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={itemClass}>
              <ShieldCheck className="w-4 h-4" />
              Admin review
            </Link>
          )}
          <button role="menuitem" type="button" onClick={onSignOut} className={itemClass}>
            <LogOut className="h-4 w-4 text-faint" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
