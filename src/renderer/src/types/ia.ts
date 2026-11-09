export type TipoMaterialIA = 'resumen' | 'cuestionario' | 'mapaMental';

export const EXTENSIONES_FUENTE_IA = ['pdf', 'docx'];
export const esFuenteIA = (extension: string | null | undefined) =>
  !!extension && EXTENSIONES_FUENTE_IA.includes(extension.toLowerCase());

export const NOMBRE_TIPO_IA: Record<TipoMaterialIA, string> = {
  resumen: 'Resumen',
  cuestionario: 'Cuestionario',
  mapaMental: 'Mapa mental',
};

// El router informa qué IA respondió; si es una que no está acá, se muestra tal cual.
const NOMBRES_PROVEEDOR: Record<string, string> = {
  azure: 'Luna (Azure)',
  gemini: 'Gemini',
  ollama: 'Gemma (sin internet)',
};
export const nombreProveedorIA = (proveedor: string) => NOMBRES_PROVEEDOR[proveedor] ?? proveedor;

export interface Resumen {
  titulo: string;
  ideasClave: string[];
  secciones: { titulo: string; contenido: string }[];
}

export interface Pregunta {
  enunciado: string;
  opciones: string[];
  indiceCorrecta: number;
  explicacion: string;
}

export interface Cuestionario {
  titulo: string;
  preguntas: Pregunta[];
}

export interface NodoMapa {
  id: string;
  texto: string;
  padreId: string | null;
}

export interface MapaMental {
  titulo: string;
  nodos: NodoMapa[];
}

export interface ContenidoPorTipo {
  resumen: Resumen;
  cuestionario: Cuestionario;
  mapaMental: MapaMental;
}

export type ContenidoIA = ContenidoPorTipo[TipoMaterialIA];

export interface PropuestaIA {
  trabajoId: string;
  idArchivo: number;
  fuente: string;
  tipo: TipoMaterialIA;
  contenido: ContenidoIA;
  proveedores: string[];
}

export interface MaterialIA {
  idMaterialIA: number;
  idUsuario: number;
  idArchivo: number | null;
  tipo: TipoMaterialIA;
  titulo: string;
  contenido: ContenidoIA;
  proveedores: string[];
  fechaCreacion: string;
}

// Evento 'ia:progreso' de la cola de IA (una sola cola para toda la IA).
export interface ProgresoIA {
  id: string;
  estado: 'en_cola' | 'ejecutando' | 'terminado' | 'cancelado' | 'error';
  hechas?: number;
  total?: number;
}

export interface MaterialIAApi {
  generarMaterialIA(datos: { trabajoId: string; idArchivo: number; tipo: TipoMaterialIA; preferencias?: string }):
    Promise<{ ok: true; propuesta: PropuestaIA } | { ok: false; cancelado: true }>;
  descartarMaterialIA(datos: { trabajoId: string }): Promise<boolean>;
  guardarMaterialIA(datos: { trabajoId: string; contenido: ContenidoIA }): Promise<MaterialIA>;
  listarMaterialesIA(datos?: { idArchivo?: number }): Promise<MaterialIA[]>;
  // De la API general de IA (cola): los que usa el front de Material con IA.
  cancelar(idTrabajo: string): Promise<boolean>;
  onProgreso(callback: (progreso: ProgresoIA) => void): () => void;
}

