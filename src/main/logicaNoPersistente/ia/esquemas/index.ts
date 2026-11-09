import { z } from 'zod';
import type { TipoMaterialIA } from '../tipos';
import { resumenSchema, type Resumen } from './resumen';
import { cuestionarioSchema, type Cuestionario } from './cuestionario';
import { mapaMentalSchema, type MapaMental } from './mapaMental';

export * from './resumen';
export * from './cuestionario';
export * from './mapaMental';
export * from './flashcards';

// Un esquema por tipo de Material con IA. El registro de TODAS las tareas de IA (con su prompt
// y su JSON Schema) está en ../tareas.ts.
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

// Esquema zod → JSON Schema para pasárselo al modelo. Se quita `$schema`: algunos proveedores lo rechazan.
// Regla de Azure (modo estricto): nada de `.optional()`; usá `.nullable()` para campos opcionales.
export function aJsonSchema(esquema: z.ZodType): object {
  const { $schema: _omitido, ...resto } = z.toJSONSchema(esquema) as Record<string, unknown>;
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
