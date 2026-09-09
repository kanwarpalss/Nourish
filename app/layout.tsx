import type { Metadata } from "next";
import "./globals.css";
import { BASE_PATH } from "../shared/base-path.mjs";

export const metadata: Metadata = {
  title: "Nourish — Plan well. Track gently.",
  description: "A private, Indian-first nutrition planning and food tracking companion.",
  icons: {
    icon: `${BASE_PATH}/favicon.svg`,
    shortcut: `${BASE_PATH}/favicon.svg`,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
