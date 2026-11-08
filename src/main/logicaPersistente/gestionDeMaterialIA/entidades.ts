import type { ContenidoIA } from '../../logicaNoPersistente/ia/esquemas';
import type { TipoMaterialIA } from '../../logicaNoPersistente/ia/tipos';

export interface MaterialIA {
  idMaterialIA: number;
  idUsuario: number;
  idArchivo: number | null;
  tipo: TipoMaterialIA;
  titulo: string;
  contenido: ContenidoIA;
  // Qué IA respondió (lo informa el router).
  proveedores: string[];
  fechaCreacion: Date;
}

// Lo que devuelve la IA antes de guardar: va a la pantalla previa.
export interface PropuestaIA {
  trabajoId: string;
  idArchivo: number;
  fuente: string;
  tipo: TipoMaterialIA;
  contenido: ContenidoIA;
  proveedores: string[];
}
