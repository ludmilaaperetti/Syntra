import { z } from 'zod';

// Respuesta del Chat con IA. Es un objeto (y no texto suelto) para que pase por el mismo
// router que el resto: valida, reintenta si el formato está mal y usa el respaldo.
export const respuestaChatSchema = z.object({
  respuesta: z
    .string()
    .trim()
    .min(1, { error: 'La respuesta está vacía.' })
    .max(20000, { error: 'La respuesta es demasiado larga.' }),
});

export type RespuestaChat = z.infer<typeof respuestaChatSchema>;
