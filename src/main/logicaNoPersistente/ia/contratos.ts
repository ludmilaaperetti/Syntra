// Lo que esta parte (esquemas, fragmentador, extractor, pantalla previa) necesita de las piezas
// que hace otro integrante: ModelProvider + Router y la cola con cancelación.
// Esas piezas tienen que cumplir estas interfaces; acá no hay ninguna implementación.

// ---------- ModelProvider + Router ----------

export interface SolicitudModelo {
  prompt: string;
  sistema?: string;
  // JSON Schema generado desde el esquema zod (ver aJsonSchema en ./esquemas).
  schema: Record<string, unknown>;
  nombreSchema: string;
  signal: AbortSignal;
  temperatura?: number;
}

// generar({ prompt, schema, signal }): el router elige la IA (Luna → Gemini → Gemma)
// y devuelve el texto tal cual lo respondió. La validación con zod y el reintento
// se hacen de este lado (generarConEsquema.ts).
export interface RouterIA {
  generar(solicitud: SolicitudModelo): Promise<{ texto: string; proveedor: string }>;
}

// ---------- Cola con cancelación ----------

export type EstadoTrabajoIA = 'en_cola' | 'en_curso' | 'completado' | 'cancelado' | 'error';

// Lo que llega al front por 'ia:progreso': "parte 3 de 8".
export interface ProgresoIA {
  trabajoId: string;
  estado: EstadoTrabajoIA;
  parte: number;
  total: number;
  proveedor?: string;
  mensaje?: string;
}

// Lo que la cola le pasa a cada trabajo.
export interface ContextoTrabajo {
  signal: AbortSignal;
  // Avisa "parte X de N" a la pantalla.
  reportar: (parte: number, total: number, extra?: { proveedor?: string; mensaje?: string }) => void;
}

export interface ColaIA {
  encolar<T>(trabajoId: string, trabajo: (ctx: ContextoTrabajo) => Promise<T>): Promise<T>;
  cancelar(trabajoId: string): boolean;
  cancelarTodo(): void;
  alProgreso(escucha: (progreso: ProgresoIA) => void): void;
}

// ---------- Cancelación ----------

// Si el usuario cancela, se corta todo: no es un error para mostrar.
export class ErrorCancelado extends Error {
  constructor() {
    super('Cancelado por el usuario.');
    this.name = 'AbortError';
  }
}

export const esCancelacion = (error: unknown, signal?: AbortSignal): boolean =>
  signal?.aborted === true || (error instanceof Error && error.name === 'AbortError');
