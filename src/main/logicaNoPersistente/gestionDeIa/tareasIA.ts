// src/main/logicaNoPersistente/ia/tareasIA.ts
// Registro de tareas implementadas: para sumar una (cuestionario, guía, mapa...) agregás su
// esquema en esquemas.ts, su prompt en prompts.ts y una entrada acá. El router y la cola no cambian.
import { EsquemaFlashcards, EsquemaResumen, aJsonSchema } from './esquemas.js';
import { SISTEMA_FLASHCARDS, SISTEMA_RESUMEN } from './prompts.js';
import type { Esquema } from './tipos.js';

export interface DefTarea {
  sistema: string;
  esquema: Esquema<unknown>;
  esquemaJson: object;
}

export const TAREAS_IA = {
  resumen: { sistema: SISTEMA_RESUMEN, esquema: EsquemaResumen, esquemaJson: aJsonSchema(EsquemaResumen) },
  flashcards: { sistema: SISTEMA_FLASHCARDS, esquema: EsquemaFlashcards, esquemaJson: aJsonSchema(EsquemaFlashcards) },
} satisfies Record<string, DefTarea>;

export type TareaImplementada = keyof typeof TAREAS_IA;
export const NOMBRES_TAREAS = Object.keys(TAREAS_IA) as [TareaImplementada, ...TareaImplementada[]];
