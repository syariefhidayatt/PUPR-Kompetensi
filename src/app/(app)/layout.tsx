import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { requireUser } from "@/server/auth/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={user.permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={user.name} roles={user.roles} permissions={user.permissions} />
        <main className="min-w-0 flex-1 p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
