"use server";

import { revalidatePath } from "next/cache";
import { daftarBatchSchema, setujuiSchema, tolakSchema } from "@/lib/schemas/batch";
import { usulanSchema } from "@/lib/schemas/usulan";
import { requirePermission } from "@/server/auth/guards";
import { scopeFor } from "@/server/auth/rbac";
import { batalkanUsulan, createUsulan, type Aktor } from "@/server/services/usulan";
import { daftarkanKeBatch, setujuiUsulan, tolakUsulan } from "@/server/services/usulan-approval";
import { parseForm, run, type ActionResult } from "@/server/services/master/shared";

type SessionUser = Awaited<ReturnType<typeof requirePermission>>["user"];
const aktorDari = (u: SessionUser): Aktor => ({
  username: u.username,
  idUser: BigInt(u.id),
  roles: u.roles,
  scope: scopeFor(u),
});

function segarkan() {
  revalidatePath("/pengelolaan/usulan");
  revalidatePath("/pelatihan/learning-path");
  revalidatePath("/pengelolaan/batch");
}

export async function createUsulanAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requirePermission("usulan.create");
    await createUsulan(parseForm(usulanSchema, fd), aktorDari(user));
    segarkan();
  });
}

export async function batalkanUsulanAction(token: string): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requirePermission("usulan.update");
    await batalkanUsulan(token, aktorDari(user));
    segarkan();
  });
}

export async function setujuiUsulanAction(token: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requirePermission("usulan.approve");
    await setujuiUsulan(token, parseForm(setujuiSchema, fd).batch, aktorDari(user));
    segarkan();
  });
}

export async function tolakUsulanAction(token: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requirePermission("usulan.approve");
    await tolakUsulan(token, parseForm(tolakSchema, fd).alasan, aktorDari(user));
    segarkan();
  });
}

export async function daftarBatchAction(token: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requirePermission("usulan.approve");
    await daftarkanKeBatch(token, parseForm(daftarBatchSchema, fd).batch, aktorDari(user));
    segarkan();
    revalidatePath("/pengelolaan/batch");
  });
}
