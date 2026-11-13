"use server";

import { unitKerjaSchema } from "@/lib/schemas/unit";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";
import { createUnitKerja, removeUnitKerja, updateUnitKerja } from "@/server/services/master/unit";

const PATH = "/master/unit-kerja";

export async function createUnitKerjaAction(fd: FormData): Promise<ActionResult> {
  return mutate("unit_kerja.create", PATH, async (actor, scope) => {
    await createUnitKerja(parseForm(unitKerjaSchema, fd), actor, scope);
  });
}
export async function updateUnitKerjaAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("unit_kerja.update", PATH, async (actor, scope) => {
    await updateUnitKerja(token, parseForm(unitKerjaSchema, fd), actor, scope);
  });
}
export async function deleteUnitKerjaAction(token: string): Promise<ActionResult> {
  return mutate("unit_kerja.delete", PATH, async (actor, scope) => {
    await removeUnitKerja(token, actor, scope);
  });
}
