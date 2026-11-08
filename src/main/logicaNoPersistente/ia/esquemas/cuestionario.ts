import { z } from 'zod';

export const preguntaSchema = z.object({
  enunciado: z.string().trim().min(1, { error: 'Hay una pregunta sin enunciado.' }).describe('La pregunta'),
  opciones: z.array(z.string().trim().min(1, { error: 'Hay una opción vacía.' }))
    .min(2, { error: 'Cada pregunta necesita al menos 2 opciones.' })
    .max(6, { error: 'Como máximo 6 opciones por pregunta.' })
    .describe('Opciones de respuesta (idealmente 4)'),
  indiceCorrecta: z.number().int().min(0).describe('Índice (desde 0) de la opción correcta'),
  explicacion: z.string().trim().min(1, { error: 'Falta la explicación de una pregunta.' })
    .describe('Por qué la opción correcta es la correcta'),
})
  // JSON Schema no puede expresar estas reglas, así que no le llegan al modelo;
  // pero se validan igual y, si fallan, el router reintenta pasándole el error.
  .superRefine((p, ctx) => {
    if (p.indiceCorrecta >= p.opciones.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['indiceCorrecta'],
        message: `La opción correcta (${p.indiceCorrecta}) no existe: hay ${p.opciones.length} opciones.`,
      });
    }
    const normalizadas = p.opciones.map((o) => o.trim().toLowerCase());
    if (new Set(normalizadas).size !== normalizadas.length) {
      ctx.addIssue({ code: 'custom', path: ['opciones'], message: 'Hay opciones repetidas.' });
    }
  });

export const cuestionarioSchema = z.object({
  titulo: z.string().trim()
    .min(1, { error: 'El cuestionario necesita un título.' })
    .max(200, { error: 'El título no puede superar los 200 caracteres.' }),
  preguntas: z.array(preguntaSchema).min(1, { error: 'El cuestionario necesita al menos una pregunta.' }),
});

export type Pregunta = z.infer<typeof preguntaSchema>;
export type Cuestionario = z.infer<typeof cuestionarioSchema>;
