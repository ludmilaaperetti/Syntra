// src/main/logicaNoPersistente/ia/esquemas.ts
// Requiere zod 4:  npm i zod@^4   (usa z.toJSONSchema)
import { z } from 'zod';

export const EsquemaResumen = z.object({
  titulo: z.string().min(3).max(200),
  puntos: z.array(z.string().min(3).max(500)).min(1).max(20),
  resumen: z.string().min(20).max(4000),
});
export type Resumen = z.infer<typeof EsquemaResumen>;

export const EsquemaFlashcards = z.object({
  tarjetas: z
    .array(
      z.object({
        frente: z.string().min(3).max(300),
        dorso: z.string().min(1).max(1000),
        fuente: z.string().min(10), // fragmento literal del material
      }),
    )
    .min(1)
    .max(50),
});
export type Flashcards = z.infer<typeof EsquemaFlashcards>;

/**
 * JSON Schema para pasárselo al modelo. Se quita `$schema`: algunos proveedores lo rechazan.
 * Regla de Azure (modo estricto): nada de `.optional()`; usá `.nullable()` para campos opcionales.
 */
export function aJsonSchema(esquema: z.ZodType): object {
  const { $schema: _omitido, ...resto } = z.toJSONSchema(esquema) as Record<string, unknown>;
  return resto;
}

/** Validación semántica que zod no puede hacer: la fuente debe existir en el material. */
export function validarFuentes(f: Flashcards, material: string): Flashcards {
  const norm = (t: string) => t.replace(/\s+/g, ' ').toLowerCase();
  const base = norm(material);
  const vistos = new Set<string>();
  const validas = f.tarjetas.filter((t) => {
    const clave = norm(t.frente);
    if (vistos.has(clave) || t.frente === t.dorso || !base.includes(norm(t.fuente))) return false;
    vistos.add(clave);
    return true;
  });
  if (validas.length === 0) throw new Error('Ninguna tarjeta tiene fuente verificable');
  return { tarjetas: validas };
}

// ---------- Cuestionario (ejemplo de tarea agregada siguiendo la guía) ----------
export const EsquemaCuestionario = z.object({
  preguntas: z
    .array(
      z.object({
        enunciado: z.string().min(5).max(400),
        opciones: z.array(z.string().min(1).max(300)).length(4),
        correcta: z.number().int().min(0).max(3), // índice dentro de `opciones`
        explicacion: z.string().min(5).max(600),
        fuente: z.string().min(10), // fragmento literal del material
      }),
    )
    .min(1)
    .max(30),
});
export type Cuestionario = z.infer<typeof EsquemaCuestionario>;

/** Descarta preguntas con opciones repetidas, enunciado duplicado o fuente que no está en el material. */
export function validarCuestionario(c: Cuestionario, material: string): Cuestionario {
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  const base = norm(material);
  const vistos = new Set<string>();
  const validas = c.preguntas.filter((p) => {
    const enunciado = norm(p.enunciado);
    const opciones = new Set(p.opciones.map(norm));
    if (vistos.has(enunciado) || opciones.size !== p.opciones.length || !base.includes(norm(p.fuente))) return false;
    vistos.add(enunciado);
    return true;
  });
  if (validas.length === 0) throw new Error('Ninguna pregunta es válida');
  return { preguntas: validas };
}
