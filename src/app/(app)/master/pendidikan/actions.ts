"use server";

import { refSchema } from "@/lib/schemas/ref-pegawai";
import { mutate } from "@/server/services/master/mutate";
import { createRef, removeRef, updateRef } from "@/server/services/master/ref-pegawai";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/pendidikan";

export async function createPendidikanAction(fd: FormData): Promise<ActionResult> {
  return mutate("pendidikan.create", PATH, async (actor) => {
    await createRef("pendidikan", parseForm(refSchema, fd), actor);
  });
}
export async function updatePendidikanAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("pendidikan.update", PATH, async (actor) => {
    await updateRef("pendidikan", token, parseForm(refSchema, fd), actor);
  });
}
export async function deletePendidikanAction(token: string): Promise<ActionResult> {
  return mutate("pendidikan.delete", PATH, async (actor) => {
    await removeRef("pendidikan", token, actor);
  });
}
