import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinanzasFácil",
  description: "Control de ingresos y gastos para tu negocio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  );
}
