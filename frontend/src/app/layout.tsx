import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnalytiQ - E-Ticaret Analytics Platformu",
  description:
    "Tüm pazaryerleri ve e-ticaret platformlarınızı tek panelden yönetin",
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
