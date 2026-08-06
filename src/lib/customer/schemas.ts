import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail."),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků."),
  firstName: z.string().trim().min(1, "Zadejte jméno.").max(100),
  lastName: z.string().trim().min(1, "Zadejte příjmení.").max(100),
  phone: z.string().trim().max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail."),
  password: z.string().min(1, "Zadejte heslo."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail."),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků."),
});

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const savedAddressSchema = z.object({
  firstName: z.string().trim().min(1, "Zadejte jméno.").max(100),
  lastName: z.string().trim().min(1, "Zadejte příjmení.").max(100),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  addressStreet: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  addressCity: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  addressPostalCode: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
});
