import { Persistencia } from '../../persistencia/persistencia';
import type { ContenidoIA } from '../../logicaNoPersistente/ia/esquemas';
import type { TipoMaterialIA } from '../../logicaNoPersistente/ia/tipos';
import { MaterialIA } from './entidades';
import { materializarMaterialIA } from './materializador';

export interface DatosGuardarMaterialIA {
  idUsuario: number;
  idArchivo: number | null;
  tipo: TipoMaterialIA;
  contenido: ContenidoIA;
  proveedores: string[];
}

// Guarda el material que el usuario confirmó en la pantalla previa.
export class GuardarMaterialIA {
  constructor(private readonly persistencia: Persistencia) {}

  async ejecutar(datos: DatosGuardarMaterialIA): Promise<MaterialIA> {
    const filas = await this.persistencia.ejecutar(
      `INSERT INTO materiales_ia (id_usuario, id_archivo, tipo, titulo, contenido, proveedores)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        datos.idUsuario,
        datos.idArchivo,
        datos.tipo,
        datos.contenido.titulo,
        JSON.stringify(datos.contenido),
        datos.proveedores,
      ],
    );
    return materializarMaterialIA(filas[0]);
  }
}
