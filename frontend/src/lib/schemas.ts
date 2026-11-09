import { z } from "zod";

import { isValidDocument } from "./documents";

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

const req = (msg: string) => z.string().trim().min(1, msg);

export const customerSchema = z.object({
  document: z.string().refine(isValidDocument, "CPF/CNPJ inválido"),
  name: req("Informe o nome"),
  trade_name: z.string(),
  email: z.string(),
  phone: z.string(),
  contact_name: z.string(),
  notes: z.string(),
  zip_code: z.string().refine((v) => v.replace(/\D/g, "").length === 8, "CEP inválido"),
  street: req("Informe a rua"),
  number: req("Informe o número"),
  complement: z.string(),
  district: req("Informe o bairro"),
  city: req("Informe a cidade"),
  state: z.string().refine((v) => (UFS as readonly string[]).includes(v.trim().toUpperCase()), "UF inválida"),
  ibge_city_code: z.string().refine((v) => v === "" || /^\d{7}$/.test(v), "Código IBGE com 7 dígitos"),
});
export type CustomerForm = z.infer<typeof customerSchema>;

export const rigSchema = z.object({
  name: req("Informe o nome"),
  max_diameter_cm: z.string().refine((v) => /^\d+$/.test(v) && +v >= 20 && +v <= 120, "Entre 20 e 120 cm"),
  max_depth_m: z.string().refine((v) => /^\d+(,\d{1,2})?$/.test(v) && +v.replace(",", ".") > 0 && +v.replace(",", ".") <= 40, "Entre 0 e 40 m"),
  status: z.enum(["active", "maintenance", "inactive"]),
  notes: z.string(),
});
export type RigForm = z.infer<typeof rigSchema>;

export const userSchema = z.object({
  name: req("Informe o nome"),
  email: z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail inválido"),
  password: z.string().min(10, "Mínimo de 10 caracteres"),
  role: z.enum(["admin", "office", "operator"]),
});
export type UserForm = z.infer<typeof userSchema>;

export const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());
