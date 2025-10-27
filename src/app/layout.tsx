import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/context/WalletContext";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Bitcoin Script Builder Playground",
  description: "Create & execute custom Bitcoin scripts on testnet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WalletProvider>
          {children}
          <Toaster position="top-right" />
        </WalletProvider>
      </body>
    </html>
  );
}
