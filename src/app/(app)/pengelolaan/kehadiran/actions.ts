"use server";

import { z } from "zod";
import { AppError } from "@/server/errors";
import { mutate } from "@/server/services/master/mutate";
import type { ActionResult } from "@/server/services/master/shared";
import { perbaikiDataKehadiran, simpanVerifikasi } from "@/server/services/pengelolaan";

const schema = z
  .array(z.object({ token: z.string().min(1).max(64), status: z.string().min(1).max(20) }))
  .min(1)
  .max(1000);

export async function simpanKehadiranAction(
  batch: string,
  entries: { token: string; status: string }[],
): Promise<ActionResult<{ diubah: number }>> {
  return mutate("kehadiran.verify", "/pengelolaan/kehadiran", async (actor, scope) => {
    const r = schema.safeParse(entries);
    if (!r.success) throw new AppError("INVALID", 422, "Data tidak valid.");
    return simpanVerifikasi(batch, r.data, actor, scope);
  });
}

const perbaikanSchema = z.object({
  token: z.string().min(1).max(64),
  statusKehadiran: z.enum(["terdaftar", "hadir", "selesai", "tidak_hadir"]),
  nilai: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().min(0).max(100).nullable(),
  ),
  statusLulus: z.enum(["lulus", "tidak_lulus"]),
  alasan: z.string().trim().min(5, "Alasan perbaikan wajib diisi (minimal 5 karakter).").max(1000),
});

export async function perbaikiKehadiranAction(
  batch: string,
  peserta: string,
  input: { statusKehadiran: string; nilai: number | null; statusLulus: string; alasan: string },
): Promise<ActionResult<void>> {
  return mutate("kehadiran.verify", `/pengelolaan/kehadiran/${batch}`, async (actor, scope) => {
    const r = perbaikanSchema.safeParse({ ...input, token: peserta });
    if (!r.success)
      throw new AppError(
        "INVALID",
        422,
        r.error.issues[0]?.message ?? "Data perbaikan tidak valid.",
      );
    await perbaikiDataKehadiran(batch, peserta, r.data, actor, scope);
  });
}
