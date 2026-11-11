// src/main/logicaNoPersistente/ia/tareasIA.ts
// Registro de tareas implementadas. Para sumar una: esquema (esquemas.ts) + prompt (prompts.ts)
// + combinar (postproceso.ts) + una entrada acá. El router, la cola, el IPC y el preload NO cambian.
import {
  EsquemaCuestionario,
  EsquemaFlashcards,
  EsquemaResumen,
  aJsonSchema,
  type Cuestionario,
  type Flashcards,
  type Resumen,
} from './esquemas.js';
import { combinarCuestionario, combinarFlashcards, combinarResumenes } from './postproceso.js';
import { SISTEMA_CUESTIONARIO, SISTEMA_FLASHCARDS, SISTEMA_RESUMEN } from './prompts.js';
import type { Esquema } from './tipos.js';

export interface DefTarea {
  sistema: string;
  esquema: Esquema<unknown>;
  esquemaJson: object;
  /** Une los resultados de todos los fragmentos en uno y valida el contenido contra el material. */
  combinar: (partes: unknown[], material: string) => unknown;
}

export const TAREAS_IA = {
  resumen: {
    sistema: SISTEMA_RESUMEN,
    esquema: EsquemaResumen,
    esquemaJson: aJsonSchema(EsquemaResumen),
    combinar: (partes) => combinarResumenes(partes as Resumen[]),
  },
  flashcards: {
    sistema: SISTEMA_FLASHCARDS,
    esquema: EsquemaFlashcards,
    esquemaJson: aJsonSchema(EsquemaFlashcards),
    combinar: (partes, material) => combinarFlashcards(partes as Flashcards[], material),
  },
  cuestionario: {
    sistema: SISTEMA_CUESTIONARIO,
    esquema: EsquemaCuestionario,
    esquemaJson: aJsonSchema(EsquemaCuestionario),
    combinar: (partes, material) => combinarCuestionario(partes as Cuestionario[], material),
  },
} satisfies Record<string, DefTarea>;

export type TareaImplementada = keyof typeof TAREAS_IA;
export const NOMBRES_TAREAS = Object.keys(TAREAS_IA) as [TareaImplementada, ...TareaImplementada[]];
