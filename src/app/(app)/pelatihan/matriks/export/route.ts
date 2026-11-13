import type { NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { auth } from "@/server/auth/auth";
import { hasPermission, scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { rateLimit } from "@/server/ratelimit";
import { loadMatriks } from "@/server/services/matriks";
import { buildMatriksWorkbook } from "@/server/services/matriks-xlsx";

export const dynamic = "force-dynamic";

const plain = (status: number, text: string) => new Response(text, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const user = (await auth())?.user;
  if (!user?.id) return plain(401, "Unauthorized");
  if (!hasPermission(user, "pelatihan.view")) return plain(404, "Not found"); // tidak membocorkan keberadaan
  if (!(await rateLimit(`export-matriks:${user.id}`, 10, 60))) return plain(429, "Terlalu banyak permintaan. Coba lagi sebentar.");

  try {
    const view = await loadMatriks(scopeFor(user), req.nextUrl.searchParams.get("jf") || undefined);
    if (!view.selected || !view.data) return plain(404, "Not found");
    const label = view.options.find((o) => o.value === view.selected)?.label ?? "JF";
    const buf = await buildMatriksWorkbook(view.data, label, view.multiRumpun);
    const slug = label.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "jf";
    await audit("export.matriks", { entitas: "Jf", actor: user.username, meta: { jf: slug } });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="matriks-pelatihan-${slug}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError && e.status === 404) return plain(404, "Not found");
    logger.error({ err: e }, "ekspor matriks gagal");
    return plain(500, "Gagal membuat file.");
  }
}
