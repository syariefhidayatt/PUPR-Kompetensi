"use server";

import { jfSchema } from "@/lib/schemas/master";
import { createJf, removeJf, updateJf } from "@/server/services/master/jf";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/jf";

export async function createJfAction(fd: FormData): Promise<ActionResult> {
  return mutate("jf.create", PATH, async (actor) => {
    await createJf(parseForm(jfSchema, fd), actor);
  });
}

export async function updateJfAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("jf.update", PATH, async (actor) => {
    await updateJf(token, parseForm(jfSchema, fd), actor);
  });
}

export async function deleteJfAction(token: string): Promise<ActionResult> {
  return mutate("jf.delete", PATH, async (actor) => {
    await removeJf(token, actor);
  });
}
