import type { ActionResult } from "@/server/services/master/shared";

export type Option = { value: string; label: string };

export type PelatihanRow = {
  id: string;
  program: string; // token program
  programLabel: string;
  namaPelatihan: string;
  deskripsi: string;
  jenisPelatihan: string;
  kategoriPelatihan: string;
  isPeriode: boolean;
  kPeriode: number | null;
  isRefreshment: boolean;
  kRefreshment: number | null;
  dibukaLagi: number | null; // kPeriode + kRefreshment
  isSertifikat: boolean;
  statusAktif: boolean;
  jenjang: string[]; // token terpilih
  jenjangLabels: string[];
  kompetensi: Option[]; // terpilih (label ikut agar tetap tampil walau nonaktif)
  sertifikasi: string[];
};

export type ProgramOption = Option & { kompetensi: Option[] };

export type PelatihanFormOptions = {
  programs: ProgramOption[];
  jenjang: Option[];
  sertifikasi: Option[];
};

export type PelatihanCreateAction = (fd: FormData) => Promise<ActionResult>;
export type PelatihanUpdateAction = (token: string, fd: FormData) => Promise<ActionResult>;
export type PelatihanDeleteAction = (token: string) => Promise<ActionResult>;
