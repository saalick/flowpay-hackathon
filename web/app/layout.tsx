import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Providers } from "./providers";
import { DesktopNav } from "@/components/DesktopNav";
import { ToastProvider } from "@/components/Toast";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["400", "500", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "FlowPay — Scan. Pay. Instantly.",
  description: "Pay local merchants in USDC on Avalanche. They receive baht.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <ToastProvider>
            <DesktopNav />
            {children}
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
