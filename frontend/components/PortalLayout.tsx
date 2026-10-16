"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Rocket,
  Briefcase,
  Layers,
  Sparkles,
  Users,
  Search,
  Heart,
  PlusCircle,
  Bell,
  User,
  Settings,
  ShieldCheck,
  Lock,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Sliders,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/api";

interface PortalLayoutProps {
  role: "FOUNDER" | "INVESTOR";
  children: React.ReactNode;
  activeItem?: string;
  onSelectItem?: (id: string) => void;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function PortalLayout({
  role,
  children,
  activeItem,
  onSelectItem,
  title,
  subtitle,
  actions,
}: PortalLayoutProps) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    api.getUnreadNotificationCount(role).then((count) => {
      if (mounted) setUnreadCount(count);
    });
    return () => {
      mounted = false;
    };
  }, [role, activeItem]);

  const founderNav: NavItem[] = [
    { id: "overview", label: "Dashboard", href: "/founder/dashboard", icon: Layers },
    { id: "projects", label: "My Projects", href: "/founder/dashboard?tab=projects", icon: Rocket },
    { id: "intros", label: "Intro Requests & Deal Rooms", href: "/founder/dashboard?tab=intros", icon: Briefcase, badge: "Deal Room" },
    { id: "new_project", label: "Create Project", href: "/founder/projects/new", icon: PlusCircle },
    { id: "readiness", label: "AI Readiness Report", href: "/founder/dashboard?tab=readiness", icon: Sparkles, badge: "Private" },
    { id: "investors", label: "Investor Discovery", href: "/founder/dashboard?tab=investors", icon: Users },
    {
      id: "notifications",
      label: "Notifications",
      href: "/founder/dashboard?tab=notifications",
      icon: Bell,
      badge: unreadCount > 0 ? `${unreadCount} new` : undefined,
    },
    { id: "profile", label: "Profile", href: "/founder/dashboard?tab=profile", icon: User },
    { id: "settings", label: "Settings", href: "/founder/dashboard?tab=settings", icon: Settings },
  ];

  const investorNav: NavItem[] = [
    { id: "overview", label: "Dealflow Overview", href: "/investor/dashboard", icon: Layers },
    { id: "recommended", label: "Recommended Projects", href: "/investor/dashboard?tab=recommended", icon: Sparkles },
    { id: "browse", label: "Browse Projects", href: "/investor/dashboard?tab=browse", icon: Search },
    { id: "interests", label: "My Interests", href: "/investor/dashboard?tab=interests", icon: Heart },
    { id: "preferences", label: "Investment Criteria", href: "/investor/preferences", icon: Sliders },
    {
      id: "notifications",
      label: "Notifications",
      href: "/investor/dashboard?tab=notifications",
      icon: Bell,
      badge: unreadCount > 0 ? `${unreadCount} new` : undefined,
    },
    { id: "profile", label: "Profile", href: "/investor/dashboard?tab=profile", icon: User },
    { id: "settings", label: "Settings", href: "/investor/dashboard?tab=settings", icon: Settings },
  ];


  const navItems = role === "FOUNDER" ? founderNav : investorNav;

  const handleNavClick = (item: NavItem) => {
    setMobileSidebarOpen(false);
    if (onSelectItem) {
      onSelectItem(item.id);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-[#0F172A]">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0F1E36] border-b border-[#1F3354] text-white sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0B1628] border border-[#1F3354] flex items-center justify-center font-bold text-xs text-white">
            V<span className="text-[#38BDF8]">X</span>
          </div>
          <span className="font-bold text-sm tracking-tight font-display">
            Venture<span className="text-[#38BDF8]">X</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#182C4C] text-[#BAC7D5] uppercase tracking-wider font-mono ml-1">
            {role === "FOUNDER" ? "Founder" : "Investor"}
          </span>
        </div>

        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-1.5 rounded-lg bg-[#182C4C] text-white hover:bg-[#1E3860]"
          aria-label="Toggle navigation"
        >
          {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Desktop & Mobile Drawer — Deep Navy Aesthetic */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F1E36] text-white flex flex-col justify-between border-r border-[#1F3354] transition-transform duration-200 md:static md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Sidebar Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-[#182C4C] bg-[#0B1628]">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#182C4C] border border-[#223E68] flex items-center justify-center font-bold text-sm shadow-sm font-display text-white">
                V<span className="text-[#38BDF8]">X</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight font-display text-white">
                  Venture<span className="text-[#38BDF8]">X</span>
                </span>
                <span className="text-[10px] text-[#8DA0B5] font-medium tracking-wider uppercase -mt-1 font-mono">
                  {role === "FOUNDER" ? "Founder Workspace" : "Investor Portal"}
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden text-[#BAC7D5] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Privacy Status Banner in Sidebar */}
          <div className="px-4 py-3 mx-3 my-3 rounded-lg bg-[#0B1628] border border-[#182C4C] text-xs">
            {role === "FOUNDER" ? (
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-[11px]">Private by Default</div>
                  <div className="text-[10px] text-[#8DA0B5] leading-tight mt-0.5">
                    AI readiness & gaps are strictly confidential to you.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-[11px]">Verified Dealflow</div>
                  <div className="text-[10px] text-[#8DA0B5] leading-tight mt-0.5">
                    Showing founder-approved materials matching your thesis.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeItem ? activeItem === item.id : pathname === item.href;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left group ${
                    isCurrent
                      ? "bg-[#1C355E] text-white shadow-sm border-l-2 border-[#38BDF8]"
                      : "text-[#BAC7D5] hover:bg-[#142642] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isCurrent
                          ? "text-[#38BDF8]"
                          : "text-[#7B8EA5] group-hover:text-white"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[#182C4C] text-[#38BDF8] border border-[#223E68]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer in Sidebar */}
        <div className="p-3 border-t border-[#182C4C] bg-[#0B1628]">
          <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-[#0F1E36] border border-[#182C4C]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#182C4C] border border-[#223E68] flex items-center justify-center font-bold text-xs text-[#E2E8F0]">
                {role === "FOUNDER" ? "AR" : "SL"}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white leading-tight">
                  {role === "FOUNDER" ? "Alex Rivers" : "Dr. Sarah Lin"}
                </span>
                <span className="text-[10px] text-[#8DA0B5] leading-tight">
                  {role === "FOUNDER" ? "NeuroPulse AI" : "Apex Horizon VC"}
                </span>
              </div>
            </div>

            <Link
              href={role === "FOUNDER" ? "/investor/dashboard" : "/founder/dashboard"}
              title={`Switch to ${role === "FOUNDER" ? "Investor" : "Founder"} Workspace`}
              className="p-1.5 rounded text-[#8DA0B5] hover:text-white hover:bg-[#182C4C] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        {/* Top Breadcrumb & Status Bar */}
        <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-subtle">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <Link href="/" className="hover:text-[#0F172A]">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="font-medium text-[#0F172A]">
              {role === "FOUNDER" ? "Founder Workspace" : "Investor Portal"}
            </span>
            {title && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                <span className="font-semibold text-[#1B3B6F]">{title}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-[#2E7D52]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D52]" />
              <span className="font-mono text-[11px] font-medium">FastAPI Engine Ready</span>
            </div>

            {/* Role switch toggle */}
            <Link
              href={role === "FOUNDER" ? "/investor/dashboard" : "/founder/dashboard"}
              className="text-xs font-medium text-[#64748B] hover:text-[#1B3B6F] px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] transition-colors flex items-center gap-1.5 shadow-subtle"
            >
              {role === "FOUNDER" ? (
                <>
                  <Briefcase className="w-3 h-3 text-[#2E7D52]" />
                  Switch to Investor
                </>
              ) : (
                <>
                  <Rocket className="w-3 h-3 text-[#1B3B6F]" />
                  Switch to Founder
                </>
              )}
            </Link>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}
    </div>
  );
}
