import { z } from 'zod';
import type { TipoMaterialIA } from '../tipos';
import { resumenSchema, type Resumen } from './resumen';
import { cuestionarioSchema, type Cuestionario } from './cuestionario';
import { mapaMentalSchema, type MapaMental } from './mapaMental';

export * from './resumen';
export * from './cuestionario';
export * from './mapaMental';

// Un esquema por tipo. Para sumar flashcards, guía de preguntas o extraer plan:
// agregarlo acá, en TIPOS_MATERIAL_IA, en COMBINAR y en prompts.ts.
export const ESQUEMAS_IA = {
  resumen: resumenSchema,
  cuestionario: cuestionarioSchema,
  mapaMental: mapaMentalSchema,
} as const satisfies Record<TipoMaterialIA, z.ZodType>;

export interface ContenidoPorTipo {
  resumen: Resumen;
  cuestionario: Cuestionario;
  mapaMental: MapaMental;
}

export type ContenidoIA = ContenidoPorTipo[TipoMaterialIA];

// Esquema zod → JSON Schema para el modelo (Azure response_format, Gemini responseJsonSchema, Ollama format).
// Se saca "$schema" porque algunos proveedores rechazan claves que no conocen.
export function aJsonSchema(esquema: z.ZodType): Record<string, unknown> {
  const { $schema: _sinUsar, ...resto } = z.toJSONSchema(esquema, { target: 'draft-7', unrepresentable: 'any' }) as Record<string, unknown>;
  return resto;
}

// Une lo que devolvió cada fragmento en un solo resultado. Se hace en código para no gastar tokens.
export const COMBINAR: { [T in TipoMaterialIA]: (partes: ContenidoPorTipo[T][], titulo: string) => ContenidoPorTipo[T] } = {
  resumen(partes, titulo) {
    if (partes.length === 1) return partes[0];
    return {
      titulo,
      ideasClave: [...new Set(partes.flatMap((p) => p.ideasClave))].slice(0, 15),
      secciones: partes.flatMap((p) => p.secciones),
    };
  },

  cuestionario(partes, titulo) {
    if (partes.length === 1) return partes[0];
    const vistas = new Set<string>();
    const preguntas = partes.flatMap((p) => p.preguntas).filter((q) => {
      const clave = q.enunciado.trim().toLowerCase();
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
    return { titulo, preguntas };
  },

  mapaMental(partes, titulo) {
    if (partes.length === 1) return partes[0];
    // Nodo central nuevo; el central de cada fragmento cuelga de él. El prefijo f{i}- evita ids repetidos.
    const nodos: MapaMental['nodos'] = [{ id: 'raiz', texto: titulo.slice(0, 120), padreId: null }];
    partes.forEach((parte, i) => {
      for (const n of parte.nodos) {
        nodos.push({ id: `f${i}-${n.id}`, texto: n.texto, padreId: n.padreId === null ? 'raiz' : `f${i}-${n.padreId}` });
      }
    });
    return { titulo, nodos };
  },
};
