"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { AppError } from "@/server/errors";
import {
  pegawaiLayak,
  usulkanBanyak,
  MAKS_PEGAWAI_USULAN,
  type HasilUsulanBatch,
  type PegawaiLayak,
} from "@/server/services/usulan-batch";
import type { Aktor } from "@/server/services/usulan";
import { batchSchema } from "@/lib/schemas/batch";
import {
  createBatch,
  keluarkanPeserta,
  removeBatch,
  setKehadiran,
  updateBatch,
} from "@/server/services/batch";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, run, type ActionResult } from "@/server/services/master/shared";

const PATH = "/pengelolaan/batch";

export async function createBatchAction(fd: FormData): Promise<ActionResult> {
  return mutate("batch.create", PATH, async (actor, scope) => {
    await createBatch(parseForm(batchSchema, fd), actor, scope);
  });
}
export async function updateBatchAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("batch.update", PATH, async (actor, scope) => {
    await updateBatch(token, parseForm(batchSchema, fd), actor, scope);
  });
}
export async function deleteBatchAction(token: string): Promise<ActionResult> {
  return mutate("batch.delete", PATH, async (actor, scope) => {
    await removeBatch(token, actor, scope);
  });
}
export async function kehadiranAction(token: string, status: string): Promise<ActionResult> {
  return mutate("batch.update", PATH, async (actor, scope) => {
    await setKehadiran(token, status, actor, scope); // status divalidasi di service
  });
}
export async function keluarkanPesertaAction(token: string): Promise<ActionResult> {
  return mutate("batch.update", PATH, async (actor, scope) => {
    await keluarkanPeserta(token, actor, scope);
  });
}

// ---------- Usulkan pegawai langsung ke batch ----------
type SessionUser = Awaited<ReturnType<typeof requirePermission>>["user"];
const aktorDari = (u: SessionUser): Aktor => ({
  username: u.username,
  idUser: BigInt(u.id),
  roles: u.roles,
  scope: scopeFor(u),
});

export async function muatPegawaiLayakAction(
  pelatihan: string,
): Promise<ActionResult<PegawaiLayak[]>> {
  return run(async () => {
    const { user } = await requirePermission("usulan.approve");
    return pegawaiLayak(aktorDari(user), pelatihan);
  });
}

const usulkanSchema = z.object({
  pelatihan: z.string().trim().min(1, "Pilih pelatihan").max(100),
  batch: z.string().trim().min(1, "Pilih batch").max(100),
  pegawai: z
    .array(z.string().max(100))
    .max(MAKS_PEGAWAI_USULAN, `Maksimal ${MAKS_PEGAWAI_USULAN} pegawai.`),
});

export async function usulkanPegawaiAction(input: {
  pelatihan: string;
  batch: string;
  pegawai: string[];
}): Promise<ActionResult<HasilUsulanBatch>> {
  return run(async () => {
    const { user } = await requirePermission("usulan.approve");
    const r = usulkanSchema.safeParse(input);
    if (!r.success)
      throw new AppError(
        "INVALID",
        422,
        "Periksa kembali isian Anda.",
        r.error.flatten().fieldErrors,
      );
    const hasil = await usulkanBanyak(aktorDari(user), r.data);
    revalidatePath("/pengelolaan/batch");
    revalidatePath("/pengelolaan/usulan");
    return hasil;
  });
}
