import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
