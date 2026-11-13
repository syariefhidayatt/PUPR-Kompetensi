"use server";

import { sertifikasiSchema } from "@/lib/schemas/master";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";
import { createSertifikasi, removeSertifikasi, updateSertifikasi } from "@/server/services/master/sertifikasi";

const PATH = "/master/sertifikasi";

export async function createSertifikasiAction(fd: FormData): Promise<ActionResult> {
  return mutate("sertifikasi.create", PATH, async (actor) => {
    await createSertifikasi(parseForm(sertifikasiSchema, fd), actor);
  });
}

export async function updateSertifikasiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("sertifikasi.update", PATH, async (actor) => {
    await updateSertifikasi(token, parseForm(sertifikasiSchema, fd), actor);
  });
}

export async function deleteSertifikasiAction(token: string): Promise<ActionResult> {
  return mutate("sertifikasi.delete", PATH, async (actor) => {
    await removeSertifikasi(token, actor);
  });
}
