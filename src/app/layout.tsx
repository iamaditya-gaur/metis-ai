import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-sans",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Metis AI | Meta Ads Operator Workspace",
  description:
    "Metis AI helps performance marketers run reporting and builder workflows from one operator-grade Meta ads workspace.",
  openGraph: {
    title: "Metis AI | Meta Ads Operator Workspace",
    description:
      "Brand analysis, launch strategy, ad copy, and reporting summaries in one operator-grade workflow.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Metis AI | Meta Ads Operator Workspace",
    description:
      "Reporting and builder workflows for performance marketing teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${interTight.variable}`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
