import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repliq - Customer Support Platform",
  description:
    "Tum destek kanallarinizi tek panelden yonetin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
