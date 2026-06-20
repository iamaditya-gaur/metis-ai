// All /app/* pages read the signed-in user's session from cookies and run
// per-user Supabase queries, so they must render per-request (no prerender).
export const dynamic = "force-dynamic";

export default function ProductAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="product-root">{children}</div>;
}
