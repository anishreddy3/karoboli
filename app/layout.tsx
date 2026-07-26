import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL(
    "https://karoboli-epoch.posimreddy-anishkuma.chatgpt.site",
  ),
  title: "Karoboli — Voice-native procurement for India",
  description:
    "A multilingual voice procurement agent built for the Sarvam Epoch Buildathon.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "A buyer speaks. Karoboli closes the loop.",
    description:
      "Voice-native procurement for India—from multilingual negotiation to a governed purchase outcome.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Karoboli turns multilingual voice negotiation into a protected deal room and purchase order.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A buyer speaks. Karoboli closes the loop.",
    description: "Voice-native procurement for India.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
