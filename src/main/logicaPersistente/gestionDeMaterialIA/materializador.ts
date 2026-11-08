import { MaterialIA } from './entidades';

export function materializarMaterialIA(fila: any): MaterialIA {
  return {
    idMaterialIA: fila.id_material_ia,
    idUsuario: fila.id_usuario,
    idArchivo: fila.id_archivo ?? null,
    tipo: fila.tipo,
    titulo: fila.titulo,
    contenido: fila.contenido, 
    proveedores: fila.proveedores ?? [],
    fechaCreacion: fila.fecha_creacion,
  };
}
