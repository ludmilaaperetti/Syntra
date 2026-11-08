import { z } from 'zod';

export const seccionResumenSchema = z.object({
  titulo: z.string().trim()
    .min(1, { error: 'Cada sección necesita un título.' })
    .max(200, { error: 'El título de la sección no puede superar los 200 caracteres.' })
    .describe('Título corto de la sección'),
  contenido: z.string().trim()
    .min(1, { error: 'Cada sección necesita contenido.' })
    .describe('Explicación de la sección en prosa clara'),
});

export const resumenSchema = z.object({
  titulo: z.string().trim()
    .min(1, { error: 'El resumen necesita un título.' })
    .max(200, { error: 'El título no puede superar los 200 caracteres.' })
    .describe('Título del resumen'),
  ideasClave: z.array(z.string().trim().min(1, { error: 'Hay una idea clave vacía.' }))
    .min(1, { error: 'El resumen necesita al menos una idea clave.' })
    .max(15, { error: 'Como máximo 15 ideas clave.' })
    .describe('Entre 3 y 10 ideas principales, una oración cada una'),
  secciones: z.array(seccionResumenSchema)
    .min(1, { error: 'El resumen necesita al menos una sección.' })
    .describe('Desarrollo del resumen por temas'),
});

export type Resumen = z.infer<typeof resumenSchema>;
