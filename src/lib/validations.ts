import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(60),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const createBandSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(60),
  description: z.string().max(300).optional(),
});

export const joinBandSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .length(6, "El código tiene 6 caracteres")
    .transform((c) => c.toUpperCase()),
});

export const createSongSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(100),
});

export const chatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío")
    .max(2000, "Máximo 2000 caracteres"),
});

export const updateSongSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  lyrics: z.string().max(50_000).optional(),
  scoreJson: z.unknown().optional(),
  bpm: z.number().int().min(30).max(300).optional(),
  key: z.string().max(30).optional(),
  timeSig: z.string().max(10).optional(),
});
