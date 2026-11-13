"use server";

import { instansiSchema } from "@/lib/schemas/master";
import { createInstansi, removeInstansi, updateInstansi } from "@/server/services/master/instansi";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/instansi";

export async function createInstansiAction(fd: FormData): Promise<ActionResult> {
  return mutate("instansi.create", PATH, async (actor) => {
    await createInstansi(parseForm(instansiSchema, fd), actor);
  });
}

export async function updateInstansiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("instansi.update", PATH, async (actor) => {
    await updateInstansi(token, parseForm(instansiSchema, fd), actor);
  });
}

export async function deleteInstansiAction(token: string): Promise<ActionResult> {
  return mutate("instansi.delete", PATH, async (actor) => {
    await removeInstansi(token, actor);
  });
}
