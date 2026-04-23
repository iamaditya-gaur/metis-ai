import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metis AI | Meta Ads Agent Waitlist",
  description:
    "Join the waitlist for Metis AI, a Meta Ads Agent that turns brand inputs into campaign strategy, copy, and reporting summaries.",
  openGraph: {
    title: "Metis AI | Meta Ads Agent Waitlist",
    description:
      "Brand analysis, launch strategy, ad copy, and reporting summaries in one operator-grade workflow.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Metis AI | Meta Ads Agent Waitlist",
    description:
      "Join the waitlist for Metis AI, built for performance marketing teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
