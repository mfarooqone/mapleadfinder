import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MapLeadFinder — Google Maps Leads & WhatsApp Outreach",
  description:
    "Scrape local businesses from Google Maps, build your lead database, and run safe WhatsApp and email campaigns — all in one dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
