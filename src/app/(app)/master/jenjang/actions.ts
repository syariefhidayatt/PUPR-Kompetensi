"use server";

import { jenjangSchema } from "@/lib/schemas/master";
import { createJenjang, removeJenjang, updateJenjang } from "@/server/services/master/jenjang";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/jenjang";

export async function createJenjangAction(fd: FormData): Promise<ActionResult> {
  return mutate("jenjang.create", PATH, async (actor) => {
    await createJenjang(parseForm(jenjangSchema, fd), actor);
  });
}

export async function updateJenjangAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("jenjang.update", PATH, async (actor) => {
    await updateJenjang(token, parseForm(jenjangSchema, fd), actor);
  });
}

export async function deleteJenjangAction(token: string): Promise<ActionResult> {
  return mutate("jenjang.delete", PATH, async (actor) => {
    await removeJenjang(token, actor);
  });
}
