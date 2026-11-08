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

export interface ProgresoIA {
  trabajoId: string;
  estado: 'en_cola' | 'en_curso' | 'completado' | 'cancelado' | 'error';
  parte: number;
  total: number;
  proveedor?: string;
  mensaje?: string;
}

export interface MaterialIAApi {
  generarMaterialIA(datos: { trabajoId: string; idArchivo: number; tipo: TipoMaterialIA }):
    Promise<{ ok: true; propuesta: PropuestaIA } | { ok: false; cancelado: true }>;
  cancelarMaterialIA(datos: { trabajoId: string }): Promise<boolean>;
  descartarMaterialIA(datos: { trabajoId: string }): Promise<boolean>;
  guardarMaterialIA(datos: { trabajoId: string; contenido: ContenidoIA }): Promise<MaterialIA>;
  listarMaterialesIA(datos?: { idArchivo?: number }): Promise<MaterialIA[]>;
  alProgresoIA(callback: (progreso: ProgresoIA) => void): () => void;
}
