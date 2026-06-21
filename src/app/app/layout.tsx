import { cookies } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

// All /app/* pages read the signed-in user's session from cookies and run
// per-user Supabase queries, so they must render per-request (no prerender).
export const dynamic = "force-dynamic";

export default async function ProductAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    // Middleware already enforces auth — if we end up here without env we
    // still render the shell so loading.tsx can show.
  }

  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get("metis.sidebar")?.value === "collapsed";

  return (
    <div className="product-root">
      <div
        className="product-shell"
        data-sidebar-collapsed={defaultCollapsed ? "true" : undefined}
      >
        <AppSidebar
          user={userEmail !== null ? { email: userEmail } : null}
          defaultCollapsed={defaultCollapsed}
        />
        <div className="product-main">{children}</div>
      </div>
    </div>
  );
}
