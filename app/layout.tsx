import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hub",
    template: "%s · Hub",
  },
  description:
    "One calm dashboard for calendars, tasks, and family handoffs — built for Gen X caregivers who need reliability, not another app to babysit.",
  applicationName: "Hub",
  metadataBase: new URL("https://hub.ntrr.com"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/ntrr-app-icon-125.png", type: "image/png", sizes: "125x125" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Hub",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Hub",
    description:
      "One calm dashboard for calendars, tasks, and family handoffs — a Not The Run Around service.",
    url: "https://hub.ntrr.com",
    siteName: "Hub",
    type: "website",
    images: [{ url: "/brand/ntrr-oauth-icon-512.png", width: 512, height: 512, alt: "NTRR" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {process.env.NODE_ENV !== "production" ? (
          <Script id="dev-sw-cleanup" strategy="beforeInteractive">
            {`if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})})}if('caches'in window){caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})})}`}
          </Script>
        ) : null}
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
