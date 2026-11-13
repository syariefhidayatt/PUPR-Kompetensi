"use server";

import { refSchema } from "@/lib/schemas/ref-pegawai";
import { mutate } from "@/server/services/master/mutate";
import { createRef, removeRef, updateRef } from "@/server/services/master/ref-pegawai";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/status-pegawai";

export async function createStatusPegawaiAction(fd: FormData): Promise<ActionResult> {
  return mutate("status_pegawai.create", PATH, async (actor) => {
    await createRef("statusPegawai", parseForm(refSchema, fd), actor);
  });
}
export async function updateStatusPegawaiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("status_pegawai.update", PATH, async (actor) => {
    await updateRef("statusPegawai", token, parseForm(refSchema, fd), actor);
  });
}
export async function deleteStatusPegawaiAction(token: string): Promise<ActionResult> {
  return mutate("status_pegawai.delete", PATH, async (actor) => {
    await removeRef("statusPegawai", token, actor);
  });
}
