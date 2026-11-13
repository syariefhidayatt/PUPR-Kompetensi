"use server";

import { programSchema } from "@/lib/schemas/master";
import { mutate } from "@/server/services/master/mutate";
import { createProgram, removeProgram, updateProgram } from "@/server/services/master/program-bangkom";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/program/bangkom";

export async function createProgramAction(fd: FormData): Promise<ActionResult> {
  return mutate("program_bangkom.create", PATH, async (actor, scope) => {
    await createProgram(parseForm(programSchema, fd), actor, scope);
  });
}

export async function updateProgramAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("program_bangkom.update", PATH, async (actor, scope) => {
    await updateProgram(token, parseForm(programSchema, fd), actor, scope);
  });
}

export async function deleteProgramAction(token: string): Promise<ActionResult> {
  return mutate("program_bangkom.delete", PATH, async (actor, scope) => {
    await removeProgram(token, actor, scope);
  });
}
