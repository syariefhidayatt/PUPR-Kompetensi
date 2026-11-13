import type { ActionResult } from "@/server/services/master/shared";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "switch" | "textarea" | "date";
  required?: boolean;
  optional?: boolean; // select: boleh dikosongkan
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export type ColumnDef = { key: string; label: string; kind?: "text" | "bool" };

export type MasterRow = { id: string; [key: string]: string | number | boolean | null };

export type JenisRow = {
  id: string;
  namaJenis: string;
  statusAktif: boolean;
  details: { id: string; namaDetail: string; statusAktif: boolean }[];
};

export type CreateAction = (fd: FormData) => Promise<ActionResult>;
export type UpdateAction = (token: string, fd: FormData) => Promise<ActionResult>;
export type DeleteAction = (token: string) => Promise<ActionResult>;
