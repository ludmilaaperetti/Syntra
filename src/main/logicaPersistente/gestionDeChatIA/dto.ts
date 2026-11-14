import { z } from 'zod';

// Mandar un mensaje al Chat con IA. Sin idConversacion se empieza una conversación nueva.
export const enviarMensajeChatSchema = z.object({
  // Identifica el pedido en la cola de la IA: con 'ia:cancelar' y este id se corta la respuesta.
  trabajoId: z.uuid({ error: 'Identificador de trabajo inválido.' }),
  idConversacion: z.number().int().positive().nullable().optional(),
  texto: z
    .string()
    .trim()
    .min(1, { error: 'Escribí un mensaje.' })
    .max(8000, { error: 'El mensaje no puede superar los 8000 caracteres.' }),
});

export type EnviarMensajeChatDTO = z.infer<typeof enviarMensajeChatSchema>;

// Abrir o eliminar una conversación.
export const conversacionIASchema = z.object({
  idConversacion: z.number().int().positive(),
});

export type ConversacionIADTO = z.infer<typeof conversacionIASchema>;

export const renombrarConversacionIASchema = z.object({
  idConversacion: z.number().int().positive(),
  titulo: z
    .string()
    .trim()
    .min(1, { error: 'El título no puede estar vacío.' })
    .max(120, { error: 'El título no puede superar los 120 caracteres.' }),
});

export type RenombrarConversacionIADTO = z.infer<typeof renombrarConversacionIASchema>;
