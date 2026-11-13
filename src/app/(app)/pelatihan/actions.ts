"use server";

import { pelatihanSchema } from "@/lib/schemas/master";
import { mutate } from "@/server/services/master/mutate";
import { createPelatihan, removePelatihan, updatePelatihan } from "@/server/services/master/pelatihan";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/pelatihan";

export async function createPelatihanAction(fd: FormData): Promise<ActionResult> {
  return mutate("pelatihan.create", PATH, async (actor, scope) => {
    await createPelatihan(parseForm(pelatihanSchema, fd), actor, scope);
  });
}

export async function updatePelatihanAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("pelatihan.update", PATH, async (actor, scope) => {
    await updatePelatihan(token, parseForm(pelatihanSchema, fd), actor, scope);
  });
}

export async function deletePelatihanAction(token: string): Promise<ActionResult> {
  return mutate("pelatihan.delete", PATH, async (actor, scope) => {
    await removePelatihan(token, actor, scope);
  });
}
