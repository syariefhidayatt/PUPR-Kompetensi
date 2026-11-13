"use server";

import { refSchema } from "@/lib/schemas/ref-pegawai";
import { mutate } from "@/server/services/master/mutate";
import { createRef, removeRef, updateRef } from "@/server/services/master/ref-pegawai";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/golongan";

export async function createGolonganAction(fd: FormData): Promise<ActionResult> {
  return mutate("golongan.create", PATH, async (actor) => {
    await createRef("golongan", parseForm(refSchema, fd), actor);
  });
}
export async function updateGolonganAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("golongan.update", PATH, async (actor) => {
    await updateRef("golongan", token, parseForm(refSchema, fd), actor);
  });
}
export async function deleteGolonganAction(token: string): Promise<ActionResult> {
  return mutate("golongan.delete", PATH, async (actor) => {
    await removeRef("golongan", token, actor);
  });
}
