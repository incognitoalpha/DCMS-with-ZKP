"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet, shortAddr } from "@/lib/wallet";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/resources", label: "Resources" },
  { href: "/bookings", label: "My bookings" },
  { href: "/governance", label: "Governance" },
  { href: "/activity", label: "Activity" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, chainId, expectedChainId, connecting, connect, isAdmin } = useWallet();
  const wrongChain = address !== null && chainId !== null && chainId !== expectedChainId;

  return (
    <header className="sticky top-0 z-30 backdrop-blur border-b border-cream-200 bg-cream-50/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 text-cream-50 font-display text-lg shadow-soft">
            D
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold text-forest-800">DCMS</div>
            <div className="text-[10px] uppercase tracking-widest text-forest-700/60">
              Cottage Chain
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-full bg-forest-600 px-4 py-2 text-sm font-medium text-cream-50"
                    : "rounded-full px-4 py-2 text-sm font-medium text-forest-700 hover:bg-cream-100"
                }
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={
                pathname === "/admin"
                  ? "rounded-full bg-wood-600 px-4 py-2 text-sm font-medium text-cream-50"
                  : "rounded-full px-4 py-2 text-sm font-medium text-wood-600 hover:bg-cream-100"
              }
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {wrongChain && (
            <span className="hidden sm:inline-flex chip border-red-200 bg-red-50 text-red-700">
              Wrong network · expects {expectedChainId}
            </span>
          )}
          {address ? (
            <span className="chip">
              <span className="h-2 w-2 rounded-full bg-forest-500" />
              {shortAddr(address)}
            </span>
          ) : (
            <button onClick={connect} disabled={connecting} className="btn-primary">
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
