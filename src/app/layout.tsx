import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UsageProvider } from "@/components/UsageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Pose Editor - AI画像生成×ポーズ編集",
  description: "3Dポーズエディターで理想のポーズを作成し、AIで高品質な画像を生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UsageProvider>
          {children}
        </UsageProvider>
      </body>
    </html>
  );
}
