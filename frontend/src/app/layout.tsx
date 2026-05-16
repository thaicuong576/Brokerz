import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brokerz | Nền tảng chăm sóc nhà đầu tư",
  description: "Nền tảng quản lý nhận định thị trường, danh mục và cộng đồng nhà đầu tư dành cho broker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
