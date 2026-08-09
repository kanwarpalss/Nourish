import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nourish — Plan well. Track gently.",
  description: "A private, Indian-first nutrition planning and food tracking companion.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
