import { ObtenerArchivo } from '../logicaPersistente/gestionMaterialEstudio/obtenerArchivo';
import { GuardarMaterialIA } from '../logicaPersistente/gestionDeMaterialIA/guardarMaterialIA';
import { ListarMaterialesIA } from '../logicaPersistente/gestionDeMaterialIA/listarMaterialesIA';
import type { MaterialIA as MaterialGuardado, PropuestaIA } from '../logicaPersistente/gestionDeMaterialIA/entidades';
import type {
  GenerarMaterialIADTO,
  GuardarMaterialIADTO,
  ListarMaterialesIADTO,
  TrabajoIADTO,
} from '../logicaPersistente/gestionDeMaterialIA/dto';
import { Almacenamiento } from '../persistencia/almacenamiento';
import { usuarioSesionSync } from '../sesionSync';
import { ESQUEMAS_IA } from '../logicaNoPersistente/ia/esquemas';
import { esFuenteIA, type TipoMaterialIA } from '../logicaNoPersistente/ia/tipos';
import type { ColaEjecucion } from '../logicaNoPersistente/ia/colaEjecucion';
import { GeneradorMaterialIA } from '../logicaNoPersistente/ia/generadorMaterialIA';

interface Pendiente {
  idUsuario: number;
  idArchivo: number;
  tipo: TipoMaterialIA;
  proveedores: string[];
}

function usuarioActual(): number {
  const id = usuarioSesionSync();
  if (id == null) throw new Error('No hay una sesión iniciada.');
  return id;
}

export class MaterialIA {
  // Propuestas esperando revisión. Solo se puede guardar algo que pasó por acá:
  // nada se guarda sin pasar por la pantalla previa.
  private readonly pendientes = new Map<string, Pendiente>();

  constructor(
    private readonly obtenerArchivoCasoUso: ObtenerArchivo,
    private readonly almacenamiento: Almacenamiento,
    private readonly generador: GeneradorMaterialIA,
    // La misma cola de toda la IA: el progreso sale por 'ia:progreso' y se cancela con 'ia:cancelar'.
    private readonly cola: ColaEjecucion,
    private readonly guardarCasoUso: GuardarMaterialIA,
    private readonly listarCasoUso: ListarMaterialesIA,
  ) {}

  // Genera la propuesta. No guarda nada.
  async generar(datos: GenerarMaterialIADTO): Promise<PropuestaIA> {
    const idUsuario = usuarioActual();
    // Reusa el caso de uso de Material: chequea el permiso 'archivo.ver' si es de un proyecto.
    const archivo = await this.obtenerArchivoCasoUso.ejecutar({ id: datos.idArchivo });
    if (!esFuenteIA(archivo.extension)) throw new Error('Solo se puede usar la IA con archivos PDF y DOCX.');

    const ruta = this.almacenamiento.rutaCompleta(archivo.rutaFisica);
    const { contenido, proveedores } = await this.cola.add(datos.trabajoId, (ctx) =>
      this.generador.generar(
        { ruta, extension: archivo.extension, nombre: archivo.nombre },
        datos.tipo,
        ctx,
        datos.preferencias,
      ),
    );

    this.pendientes.set(datos.trabajoId, { idUsuario, idArchivo: archivo.id, tipo: datos.tipo, proveedores });
    return {
      trabajoId: datos.trabajoId,
      idArchivo: archivo.id,
      fuente: archivo.nombre,
      tipo: datos.tipo,
      contenido,
      proveedores,
    };
  }

  descartar(datos: TrabajoIADTO): boolean {
    return this.pendientes.delete(datos.trabajoId);
  }

  // Guarda la versión que el usuario revisó y editó en la pantalla previa.
  async guardar(datos: GuardarMaterialIADTO): Promise<MaterialGuardado> {
    const idUsuario = usuarioActual();
    const pendiente = this.pendientes.get(datos.trabajoId);
    if (!pendiente || pendiente.idUsuario !== idUsuario) {
      throw new Error('No hay una propuesta de la IA para guardar. Volvé a generarla.');
    }

    // Se vuelve a validar acá: no se confía en lo que manda el front.
    const resultado = ESQUEMAS_IA[pendiente.tipo].safeParse(datos.contenido);
    if (!resultado.success) {
      throw new Error(`Revisá estos datos: ${[...new Set(resultado.error.issues.map((i) => i.message))].join(' ')}`);
    }

    const guardado = await this.guardarCasoUso.ejecutar({
      idUsuario,
      idArchivo: pendiente.idArchivo,
      tipo: pendiente.tipo,
      contenido: resultado.data,
      proveedores: pendiente.proveedores,
    });
    this.pendientes.delete(datos.trabajoId);
    return guardado;
  }

  async listar(datos: ListarMaterialesIADTO): Promise<MaterialGuardado[]> {
    return this.listarCasoUso.ejecutar(usuarioActual(), datos.idArchivo);
  }
}
