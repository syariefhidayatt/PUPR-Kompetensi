"use server";

import { unitOrganisasiSchema } from "@/lib/schemas/unit";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";
import { createUnitOrganisasi, removeUnitOrganisasi, updateUnitOrganisasi } from "@/server/services/master/unit";

const PATH = "/master/unit-organisasi";

export async function createUnitOrganisasiAction(fd: FormData): Promise<ActionResult> {
  return mutate("unit_organisasi.create", PATH, async (actor, scope) => {
    await createUnitOrganisasi(parseForm(unitOrganisasiSchema, fd), actor, scope);
  });
}
export async function updateUnitOrganisasiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("unit_organisasi.update", PATH, async (actor, scope) => {
    await updateUnitOrganisasi(token, parseForm(unitOrganisasiSchema, fd), actor, scope);
  });
}
export async function deleteUnitOrganisasiAction(token: string): Promise<ActionResult> {
  return mutate("unit_organisasi.delete", PATH, async (actor, scope) => {
    await removeUnitOrganisasi(token, actor, scope);
  });
}
