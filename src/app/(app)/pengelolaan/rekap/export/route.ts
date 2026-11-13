import type { NextRequest } from "next/server";
import { readFilters } from "@/lib/filters";
import { handleExport } from "@/server/export/handler";
import { rekapTable } from "@/server/services/pengelolaan";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handleExport(req, {
    key: "rekap",
    permission: "rekap.view",
    build: async ({ scope, sp }) => {
      const f = readFilters(Object.fromEntries(sp));
      const q = sp.get("q")?.trim().slice(0, 100) || undefined;
      const tampil = sp.get("tampil") === "batch" ? "batch" : "peserta";
      const table = await rekapTable(scope, q, f, tampil);
      return table ? { table, base: `rekap-peserta-${tampil}` } : null;
    },
  });
}
