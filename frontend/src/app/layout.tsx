import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Toast from "@/components/Toast";
import { WalletProvider } from "@/lib/wallet";

export const metadata: Metadata = {
  title: "DCMS — Decentralized Cottage Management",
  description: "Book shared cottage resources on-chain. Transparent, fair, decentralized.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <WalletProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">{children}</main>
          <Toast />
          <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-forest-700/60">
            DCMS · A blockchain demo · Built with Solidity, Hardhat, Next.js & ethers.js
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
