"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/events", label: "Events" }
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
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function closeMenus() {
    setNavMenuOpen(false);
    setUserMenuOpen(false);
  }

  return (
    <>
      <header className="app-brand-header">
        <div className="app-brand-header-inner">
          <div className="nav-menu">
            <button
              aria-expanded={navMenuOpen}
              aria-label="Open navigation menu"
              className="nav-menu-button"
              type="button"
              onClick={() => {
                setNavMenuOpen((open) => !open);
                setUserMenuOpen(false);
              }}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
            {navMenuOpen ? (
              <nav aria-label="Main navigation" className="nav-menu-panel">
                {navItems.map((item) => (
                  <Link
                    aria-current={pathname === item.href ? "page" : undefined}
                    href={item.href}
                    key={item.href}
                    onClick={closeMenus}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

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
                setNavMenuOpen(false);
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
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="app-page-content">{children}</div>
      </div>
    </>
  );
}
