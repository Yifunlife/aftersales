import type { Metadata } from "next";
import "./globals.css";
import CompanyFilingFooter from "./company-filing-footer";

export const metadata: Metadata = {
  title: "亦玩集团 · 员工工作台",
  description: "亦玩集团售后服务与员工账号管理",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}<CompanyFilingFooter/></body>
    </html>
  );
}
