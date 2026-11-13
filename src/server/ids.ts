import { createHash } from "node:crypto";
import Sqids from "sqids";
import { env } from "@/env";

/**
 * ID publik (pengganti idCipher CI4). ID integer tidak pernah keluar ke URL/payload.
 * Token memuat "jenis entitas" + id, sehingga token instansi tidak bisa dipakai sebagai token JF.
 */
export const ID_KIND = {
  instansi: 1,
  jf: 2,
  jenjang: 3,
  jenis: 4,
  jenisDetail: 5,
  sertifikasi: 6,
  kompetensi: 7,
  program: 8,
  pelatihan: 9,
  pegawai: 10,
  usulan: 11,
  penyelenggara: 12,
  batch: 13,
  peserta: 14,
  unitOrganisasi: 15,
  unitKerja: 16,
  golongan: 17,
  pendidikan: 18,
  statusPegawai: 19,
} as const;
export type IdKind = keyof typeof ID_KIND;

const BASE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Fisher–Yates deterministik berbasis salt: alfabet berbeda per salt → token tidak bisa ditebak lintas deployment.
function shuffle(alphabet: string, salt: string): string {
  const chars = [...alphabet];
  for (let i = chars.length - 1; i > 0; i--) {
    const r = createHash("sha256").update(`${salt}:${i}`).digest().readUInt32BE(0) % (i + 1);
    const a = chars[i]!;
    chars[i] = chars[r]!;
    chars[r] = a;
  }
  return chars.join("");
}

export function createIds(salt: string) {
  const sqids = new Sqids({ alphabet: shuffle(BASE_ALPHABET, salt), minLength: 10 });

  return {
    encode(kind: IdKind, id: bigint): string {
      const n = Number(id);
      if (!Number.isSafeInteger(n) || n < 0) throw new Error("ID di luar rentang yang didukung");
      return sqids.encode([ID_KIND[kind], n]);
    },
    /** Mengembalikan null untuk token rusak / bukan jenis yang diminta / tidak kanonik. */
    decode(kind: IdKind, token: unknown): bigint | null {
      if (typeof token !== "string" || token.length === 0 || token.length > 64) return null;
      const nums = sqids.decode(token);
      if (nums.length !== 2 || nums[0] !== ID_KIND[kind]) return null;
      if (sqids.encode(nums) !== token) return null; // tolak varian non-kanonik
      return BigInt(nums[1]!);
    },
  };
}

let instance: ReturnType<typeof createIds> | undefined;
export function ids() {
  return (instance ??= createIds(env.ID_SALT));
}
