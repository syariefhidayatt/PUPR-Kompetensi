import type { NextRequest } from "next/server";
import { handleExport } from "@/server/export/handler";
import { detailVerifikasi, verifikasiTable } from "@/server/services/pengelolaan";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return handleExport(req, {
    key: "kehadiran",
    permission: "kehadiran.view",
    build: async ({ scope }) => {
      const { token } = await params;
      const d = await detailVerifikasi(scope, token);
      return { table: verifikasiTable(d), base: `kehadiran-${d.pelatihan}-${d.tahun}-${d.angkatan}` };
    },
  });
}
