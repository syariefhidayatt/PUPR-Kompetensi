"use server";

import { kompetensiSchema } from "@/lib/schemas/master";
import { createKompetensi, removeKompetensi, updateKompetensi } from "@/server/services/master/kompetensi";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/kompetensi";

export async function createKompetensiAction(fd: FormData): Promise<ActionResult> {
  return mutate("kompetensi.create", PATH, async (actor, scope) => {
    await createKompetensi(parseForm(kompetensiSchema, fd), actor, scope);
  });
}

export async function updateKompetensiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("kompetensi.update", PATH, async (actor, scope) => {
    await updateKompetensi(token, parseForm(kompetensiSchema, fd), actor, scope);
  });
}

export async function deleteKompetensiAction(token: string): Promise<ActionResult> {
  return mutate("kompetensi.delete", PATH, async (actor, scope) => {
    await removeKompetensi(token, actor, scope);
  });
}
