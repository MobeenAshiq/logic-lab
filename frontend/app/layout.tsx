import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { t } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: t.common.siteTitle, template: `%s · ${t.common.appName}` },
  description: t.common.siteDescription,
  applicationName: t.common.appName,
  openGraph: {
    title: t.common.siteTitle,
    description: t.common.siteDescription,
    siteName: t.common.appName,
    type: "website",
    images: [{ url: "/brand/logo-full.png", width: 1254, height: 1254, alt: t.common.appName }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables go on <html>: globals.css applies font-sans there.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
