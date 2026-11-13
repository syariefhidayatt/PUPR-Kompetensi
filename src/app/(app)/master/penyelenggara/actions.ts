"use server";

import { penyelenggaraSchema } from "@/lib/schemas/batch";
import { mutate } from "@/server/services/master/mutate";
import { createPenyelenggara, removePenyelenggara, updatePenyelenggara } from "@/server/services/master/penyelenggara";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/penyelenggara";

export async function createPenyelenggaraAction(fd: FormData): Promise<ActionResult> {
  return mutate("penyelenggara.create", PATH, async (actor) => {
    await createPenyelenggara(parseForm(penyelenggaraSchema, fd), actor);
  });
}
export async function updatePenyelenggaraAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("penyelenggara.update", PATH, async (actor) => {
    await updatePenyelenggara(token, parseForm(penyelenggaraSchema, fd), actor);
  });
}
export async function deletePenyelenggaraAction(token: string): Promise<ActionResult> {
  return mutate("penyelenggara.delete", PATH, async (actor) => {
    await removePenyelenggara(token, actor);
  });
}
