// src/main/logicaNoPersistente/ia/tareas.ts
// Registro ÚNICO de tareas: para sumar una (guía, plan, materias...) agregás su esquema zod,
// su prompt en prompts.ts y una entrada acá. El router y la cola no cambian.
import { aJsonSchema, cuestionarioSchema, flashcardsSchema, mapaMentalSchema, resumenSchema } from './esquemas';
import { SISTEMA_CUESTIONARIO, SISTEMA_FLASHCARDS, SISTEMA_MAPA_MENTAL, SISTEMA_RESUMEN } from './prompts';
import type { Esquema } from './tipos';

export interface DefTarea {
  sistema: string;
  esquema: Esquema<unknown>;
  esquemaJson: object;
}

export const TAREAS_IA = {
  resumen: { sistema: SISTEMA_RESUMEN, esquema: resumenSchema, esquemaJson: aJsonSchema(resumenSchema) },
  cuestionario: { sistema: SISTEMA_CUESTIONARIO, esquema: cuestionarioSchema, esquemaJson: aJsonSchema(cuestionarioSchema) },
  mapaMental: { sistema: SISTEMA_MAPA_MENTAL, esquema: mapaMentalSchema, esquemaJson: aJsonSchema(mapaMentalSchema) },
  flashcards: { sistema: SISTEMA_FLASHCARDS, esquema: flashcardsSchema, esquemaJson: aJsonSchema(flashcardsSchema) },
} satisfies Record<string, DefTarea>;

export type TareaImplementada = keyof typeof TAREAS_IA;
export const NOMBRES_TAREAS = Object.keys(TAREAS_IA) as [TareaImplementada, ...TareaImplementada[]];
