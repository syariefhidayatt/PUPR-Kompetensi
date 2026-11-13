"use server";

import { biodataSchema, pegawaiBaruSchema, penempatanSchema } from "@/lib/schemas/pegawai";
import { mutate } from "@/server/services/master/mutate";
import { parseForm, type ActionResult } from "@/server/services/master/shared";
import { createPegawai, mutasiPegawai, removePegawai, updatePegawai } from "@/server/services/pegawai";

const PATH = "/kepegawaian/pegawai";

export async function createPegawaiAction(fd: FormData): Promise<ActionResult> {
  return mutate("pegawai.create", PATH, async (actor, scope) => {
    await createPegawai(parseForm(pegawaiBaruSchema, fd), actor, scope);
  });
}
export async function updatePegawaiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("pegawai.update", PATH, async (actor, scope) => {
    await updatePegawai(token, parseForm(biodataSchema, fd), actor, scope);
  });
}
export async function deletePegawaiAction(token: string): Promise<ActionResult> {
  return mutate("pegawai.delete", PATH, async (actor, scope) => {
    await removePegawai(token, actor, scope);
  });
}
export async function mutasiPegawaiAction(token: string, fd: FormData): Promise<ActionResult> {
  return mutate("pegawai.update", `${PATH}/${token}`, async (actor, scope) => {
    await mutasiPegawai(token, parseForm(penempatanSchema, fd), actor, scope);
  });
}
