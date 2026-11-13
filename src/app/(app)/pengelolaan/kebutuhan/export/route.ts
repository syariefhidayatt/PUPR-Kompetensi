import type { NextRequest } from "next/server";
import { handleExport } from "@/server/export/handler";
import { kebutuhanTable, loadKebutuhan } from "@/server/services/pengelolaan";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handleExport(req, {
    key: "kebutuhan",
    permission: "kebutuhan.view",
    build: async ({ scope, sp }) => {
      const t = sp.get("tahun") ?? "";
      const v = await loadKebutuhan(scope, { jf: sp.get("jf") || undefined, tahun: /^\d{4}$/.test(t) ? Number(t) : undefined, pelatihan: sp.get("pelatihan") || undefined });
      if (!v.selected) return null;
      return { table: kebutuhanTable(v), base: `kebutuhan-pelatihan${v.detail ? `-${v.detail.nama}` : ""}-${v.tahun}` };
    },
  });
}
