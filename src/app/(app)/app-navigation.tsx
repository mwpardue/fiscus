"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavIconName = "accounts" | "dashboard" | "events" | "settings";

const navItems: Array<{ href: Route; icon: NavIconName; label: string }> = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/accounts", icon: "accounts", label: "Accounts" },
  { href: "/events", icon: "events", label: "Events" },
  { href: "/settings", icon: "settings", label: "Settings" }
];

export function AppNavigation({
  children,
  email,
  initial
}: {
  children: React.ReactNode;
  email: string;
  initial: string;
}) {
  const pathname = usePathname();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function closeMenus() {
    setUserMenuOpen(false);
  }

  return (
    <>
      <header className="app-brand-header">
        <div className="app-brand-header-inner">
          <div aria-hidden="true" className="mobile-header-spacer" />

          <Link
            aria-label="fiscus dashboard"
            className="brand-logo-link"
            href="/dashboard"
            onClick={closeMenus}
          >
            <img
              alt="fiscus"
              className="brand-logo-light"
              height={72}
              src="/brand/fiscus-header-logo-light.svg"
              width={236}
            />
            <img
              alt="fiscus"
              className="brand-logo-dark"
              height={72}
              src="/brand/fiscus-header-logo-dark.svg"
              width={236}
            />
          </Link>

          <div className="user-menu">
            <button
              aria-expanded={userMenuOpen}
              aria-label="Open user menu"
              className="user-menu-button"
              type="button"
              onClick={() => {
                setUserMenuOpen((open) => !open);
              }}
            >
              <span>{initial}</span>
            </button>
            {userMenuOpen ? (
              <div className="user-menu-panel">
                <p className="truncate px-3 py-2 text-xs font-medium text-gray-700">
                  {email}
                </p>
                <Link href="/settings" onClick={closeMenus}>
                  Settings
                </Link>
                <form action="/logout" method="post">
                  <button>Log out</button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="app-content-shell">
        <aside className="app-sidebar">
          <nav aria-label="Main navigation">
            {navItems.map((item) => (
              <Link
                aria-current={pathname === item.href ? "page" : undefined}
                href={item.href}
                key={item.href}
                onClick={closeMenus}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="app-page-content">{children}</div>
      </div>
      <nav aria-label="Primary navigation" className="mobile-bottom-nav">
        {navItems.map((item) => (
          <Link
            aria-current={pathname === item.href ? "page" : undefined}
            href={item.href}
            key={item.href}
            onClick={closeMenus}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "accounts") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M4 7h16" />
        <path d="M5 7v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M9 13h6" />
      </svg>
    );
  }

  if (name === "events") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
        <rect height="18" rx="2" width="18" x="3" y="4" />
        <path d="M8 15h3" />
        <path d="M14 15h2" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6l-.08.08a2 2 0 0 1-3.42-1.42v-.07A1.8 1.8 0 0 0 9 17.1a1.8 1.8 0 0 0-1.98.36l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.8 1.8 0 0 0 4.6 13a1.8 1.8 0 0 0-.6-1l-.08-.08A2 2 0 0 1 5.34 8.5h.07A1.8 1.8 0 0 0 6.9 7a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.8 1.8 0 0 0 11 2.6a1.8 1.8 0 0 0 1-.6l.08-.08A2 2 0 0 1 15.5 3.34v.07A1.8 1.8 0 0 0 17.1 4.9a1.8 1.8 0 0 0 1.98-.36l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.8 1.8 0 0 0 21.4 9c0 .4.13.77.36 1.07l.05.06a2 2 0 0 1-1.42 3.42h-.07A1.8 1.8 0 0 0 19.4 15Z" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect height="8" rx="1.5" width="8" x="3" y="3" />
      <rect height="5" rx="1.5" width="8" x="13" y="3" />
      <rect height="8" rx="1.5" width="8" x="13" y="13" />
      <rect height="5" rx="1.5" width="8" x="3" y="16" />
    </svg>
  );
}
