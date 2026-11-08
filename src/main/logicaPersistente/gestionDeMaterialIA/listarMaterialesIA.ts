import { Persistencia } from '../../persistencia/persistencia';
import { MaterialIA } from './entidades';
import { materializarMaterialIA } from './materializador';

// Lista el material generado por el usuario, el más nuevo primero. Opcional: solo el de un archivo.
export class ListarMaterialesIA {
  constructor(private readonly persistencia: Persistencia) {}

  async ejecutar(idUsuario: number, idArchivo?: number): Promise<MaterialIA[]> {
    const filas = await this.persistencia.ejecutar(
      `SELECT * FROM materiales_ia
       WHERE id_usuario = $1 AND ($2::int IS NULL OR id_archivo = $2)
       ORDER BY fecha_creacion DESC`,
      [idUsuario, idArchivo ?? null],
    );
    return filas.map(materializarMaterialIA);
  }
}
