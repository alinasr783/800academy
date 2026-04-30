import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { Manrope, Plus_Jakarta_Sans, Inter } from "next/font/google";
import { Metadata } from "next";
import ClarityTracker from "@/components/ClarityTracker";
import AnalyticsTracker from "@/components/AnalyticsTracker";

const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-jakarta", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://800academy.com"),
  title: "800 Academy | The Ultimate EST Preparation Platform | أكاديمية 800",
  description: "Join 800 Academy for the best online preparation for the Egyptian American Diploma (EST). Access mock exams, detailed explanations, and personalized practice. انضم لأكاديمية 800 لأفضل تحضير لاختبار EST.",
  keywords: "800 Academy, EST preparation, SAT, ACT, Egyptian American Diploma, Math, English, Online courses, أكاديمية 800, التحضير لاختبار EST, الدبلومة الأمريكية, امتحانات تجريبية, كورسات أونلاين",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "800 Academy | The Ultimate EST Preparation Platform",
    description: "Your ultimate platform for EST, SAT, and ACT preparation in Egypt. Practice with thousands of questions and real exam simulations.",
    url: "https://800academy.com",
    siteName: "800 Academy",
    images: [
      {
        url: "/full-logo.png",
        width: 1200,
        height: 630,
        alt: "800 Academy Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "800 Academy | EST Preparation",
    description: "The most advanced platform designed specifically for EST excellence.",
    images: ["/full-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

import QueryProvider from "@/providers/QueryProvider";

import AppSidebar from "@/components/AppSidebar";

import SiteHeader from "@/components/SiteHeader";

import LayoutContentWrapper from "@/components/LayoutContentWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`light ${manrope.variable} ${jakarta.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-white text-on-surface font-body antialiased selection:bg-secondary/20"
      >
        <ClarityTracker />
        <AnalyticsTracker />
        <QueryProvider>
          <CartProvider>
            <SiteHeader />
            <LayoutContentWrapper>
              {children}
            </LayoutContentWrapper>
            <AppSidebar />
          </CartProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
