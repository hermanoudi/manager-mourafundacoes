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

const moneyBR = /^\d+(,\d{1,2})?$/;
const num = (s: string) => Number(s.replace(",", "."));

export const priceTableSchema = z
  .object({
    // vazio = a negociar (só na obra; a tabela global exige o valor de Uberlândia)
    mobilization_fee: z.string().refine((v) => v === "" || moneyBR.test(v), "Valor inválido"),
    minimum_amount: z.string().refine((v) => v === "" || moneyBR.test(v), "Valor inválido"),
    max_tabled_depth_m: z
      .string()
      .refine((v) => /^\d+(,\d{1,2})?$/.test(v) && num(v) > 0 && num(v) <= 40, "Entre 0 e 40 m"),
    items: z.array(
      z.object({
        diameter_cm: z.string().refine((v) => /^\d+$/.test(v) && +v >= 25 && +v <= 80, "Entre 25 e 80 cm"),
        price_per_m: z.string().refine((v) => moneyBR.test(v) && num(v) > 0, "Informe um preço maior que zero"),
      }),
    ),
  })
  .superRefine((t, ctx) => {
    const seen = new Set<string>();
    t.items.forEach((item, i) => {
      if (seen.has(item.diameter_cm)) {
        ctx.addIssue({ code: "custom", path: ["items", i, "diameter_cm"], message: "Diâmetro repetido" });
      }
      seen.add(item.diameter_cm);
    });
  });
export type PriceTableForm = z.infer<typeof priceTableSchema>;

const optionalDate = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida");

export const jobSchema = z
  .object({
    name: req("Informe o nome da obra"),
    customer_id: z.string(),
    start_date: optionalDate,
    end_date: optionalDate,
    notes: z.string(),
    zip_code: customerSchema.shape.zip_code,
    street: customerSchema.shape.street,
    number: customerSchema.shape.number,
    complement: z.string(),
    district: customerSchema.shape.district,
    city: customerSchema.shape.city,
    state: customerSchema.shape.state,
    ibge_city_code: customerSchema.shape.ibge_city_code,
  })
  .refine((v) => v.start_date === "" || v.end_date === "" || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "A data de término não pode ser anterior à de início",
  });
export type JobForm = z.infer<typeof jobSchema>;

export const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());
