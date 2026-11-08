import type { z } from 'zod';
import { aJsonSchema } from './esquemas';
import { ErrorCancelado, type RouterIA } from './contratos';

export class ErrorValidacionIA extends Error {
  constructor(readonly detalle: string, readonly intentos: number) {
    super(`La IA no devolvió un resultado válido después de ${intentos} intentos:\n${detalle}`);
    this.name = 'ErrorValidacionIA';
  }
}

export interface SolicitudConEsquema<T> {
  prompt: string;
  sistema?: string;
  schema: z.ZodType<T>;
  nombreSchema: string;
  signal: AbortSignal;
  temperatura?: number;
  // Reintentos si el JSON no pasa zod (por defecto 2: 3 intentos en total).
  maxReintentos?: number;
  // Para mostrar en pantalla qué IA respondió.
  alResponder?: (proveedor: string) => void;
}

// Obliga al modelo a devolver JSON válido: le manda el esquema zod como JSON Schema,
// valida la respuesta con zod y, si falla, reintenta pasándole los errores exactos.
export async function generarConEsquema<T>(
  router: RouterIA,
  solicitud: SolicitudConEsquema<T>,
): Promise<{ datos: T; proveedor: string }> {
  const schema = aJsonSchema(solicitud.schema);
  const maxIntentos = (solicitud.maxReintentos ?? 2) + 1;
  let prompt = solicitud.prompt;
  let ultimoError = '';

  for (let intento = 1; intento <= maxIntentos; intento++) {
    if (solicitud.signal.aborted) throw new ErrorCancelado();
    const { texto, proveedor } = await router.generar({
      prompt,
      sistema: solicitud.sistema,
      schema,
      nombreSchema: solicitud.nombreSchema,
      signal: solicitud.signal,
      temperatura: solicitud.temperatura,
    });
    solicitud.alResponder?.(proveedor);

    const crudo = parsearJsonTolerante(texto);
    if (crudo === undefined) {
      ultimoError = 'La respuesta no es un JSON que se pueda leer.';
    } else {
      const resultado = solicitud.schema.safeParse(crudo);
      if (resultado.success) return { datos: resultado.data, proveedor };
      ultimoError = resultado.error.issues.map((i) => `- ${i.path.join('.') || '(general)'}: ${i.message}`).join('\n');
    }

    prompt = `${solicitud.prompt}\n\n---\nTu respuesta anterior NO fue válida por estos errores:\n${ultimoError}\n`
      + 'Corregilos y devolvé SOLO el JSON que cumpla el esquema, sin texto extra.';
  }
  throw new ErrorValidacionIA(ultimoError, maxIntentos);
}

// Acepta JSON puro o envuelto en ```json ... ``` (algunos modelos lo hacen igual).
export function parsearJsonTolerante(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(limpio);
  } catch {
    const inicio = limpio.search(/[{[]/);
    const fin = Math.max(limpio.lastIndexOf('}'), limpio.lastIndexOf(']'));
    if (inicio >= 0 && fin > inicio) {
      try {
        return JSON.parse(limpio.slice(inicio, fin + 1));
      } catch {
        // sigue abajo
      }
    }
    return undefined;
  }
}
