import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { VantageProvider } from "@ojflabs/vantage/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vantage",
  description: "Self-hosted, multi-project analytics",
};

// Public — these are embedded in the client bundle by design.
const VANTAGE_PROJECT = process.env.NEXT_PUBLIC_VANTAGE_PROJECT ?? "";
const VANTAGE_WRITE_KEY = process.env.NEXT_PUBLIC_VANTAGE_WRITE_KEY ?? "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {VANTAGE_PROJECT && VANTAGE_WRITE_KEY ? (
            <VantageProvider
              project={VANTAGE_PROJECT}
              writeKey={VANTAGE_WRITE_KEY}
            />
          ) : null}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
