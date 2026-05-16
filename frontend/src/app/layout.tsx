import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brokez Intelligence | Institutional Financial Platform",
  description: "Advanced financial intelligence and automated market analysis platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
