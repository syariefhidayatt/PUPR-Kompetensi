"use server";

import { jenisSchema } from "@/lib/schemas/master";
import { createJenis, removeJenis, updateJenis } from "@/server/services/master/jenis-kompetensi";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";

const PATH = "/master/jenis-kompetensi";

export async function createJenisAction(fd: FormData): Promise<ActionResult> {
  return mutate("jenis_kompetensi.create", PATH, async (actor) => {
    await createJenis(parseForm(jenisSchema, fd), actor);
  });
}

export async function updateJenisAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("jenis_kompetensi.update", PATH, async (actor) => {
    await updateJenis(token, parseForm(jenisSchema, fd), actor);
  });
}

export async function deleteJenisAction(token: string): Promise<ActionResult> {
  return mutate("jenis_kompetensi.delete", PATH, async (actor) => {
    await removeJenis(token, actor);
  });
}
