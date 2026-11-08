// src/main/logicaNoPersistente/ia/tipos.ts

export const TAREAS = [
  'resumen',
  'cuestionario',
  'flashcards',
  'guia',
  'plan',
  'mapa',
  'materias',
] as const;
export type Tarea = (typeof TAREAS)[number]; // 'resumen' | 'cuestionario' | ...

/** Cualquier cosa con .parse() sirve: un schema de zod cumple esto sin importarlo. */
export interface Esquema<T> {
  parse(dato: unknown): T;
}

export interface PedidoGeneracion<T> {
  sistema: string; // instrucciones fijas de la app
  usuario: string; // material + preferencias (en secciones delimitadas)
  esquema: Esquema<T>; // valida la respuesta
  esquemaJson: object; // el mismo esquema como JSON Schema (para el modelo)
  signal?: AbortSignal; // para cancelar
}

/** Lo que recibe un proveedor: no necesita el validador, solo el JSON Schema. */
export type PedidoCrudo = Pick<
  PedidoGeneracion<unknown>,
  'sistema' | 'usuario' | 'esquemaJson' | 'signal'
>;

export interface ResultadoGeneracion<T> {
  dato: T;
  proveedor: string;
  ms: number;
  intentos: number;
}

export interface ProveedorModelo {
  readonly id: string; // 'luna' | 'gemini' | 'gemma'
  readonly tipo: 'online' | 'local';
  /** Rápido y sin costo: ¿vale la pena intentar con este proveedor? */
  disponible(): Promise<boolean>;
  /** Devuelve TEXTO (se espera JSON). El router valida. */
  generarJson(pedido: PedidoCrudo): Promise<string>;
}
