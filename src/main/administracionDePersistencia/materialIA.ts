import { ObtenerArchivo } from '../logicaPersistente/gestionMaterialEstudio/obtenerArchivo';
import { GuardarMaterialIA } from '../logicaPersistente/gestionDeMaterialIA/guardarMaterialIA';
import { ListarMaterialesIA } from '../logicaPersistente/gestionDeMaterialIA/listarMaterialesIA';
import { ObtenerMaterialIA } from '../logicaPersistente/gestionDeMaterialIA/obtenerMaterialIA';
import { EliminarMaterialIA } from '../logicaPersistente/gestionDeMaterialIA/eliminarMaterialIA';
import { EditarMapaMentalIA } from '../logicaPersistente/gestionDeMaterialIA/editarMapaMentalIA';
import { ListarIntentosCuestionario, ResponderCuestionario } from '../logicaPersistente/gestionDeMaterialIA/intentosCuestionario';
import { paraResolver } from '../logicaPersistente/gestionDeMaterialIA/corregirCuestionario';
import type {
  IntentoCuestionario,
  MaterialIA as MaterialGuardado,
  PropuestaIA,
} from '../logicaPersistente/gestionDeMaterialIA/entidades';
import type {
  EditarMapaMentalIADTO,
  GenerarMaterialIADTO,
  GuardarMaterialIADTO,
  ListarMaterialesIADTO,
  MaterialIADTO,
  ResponderCuestionarioDTO,
  TrabajoIADTO,
} from '../logicaPersistente/gestionDeMaterialIA/dto';
import { Almacenamiento } from '../persistencia/almacenamiento';
import { usuarioSesionSync } from '../sesionSync';
import { ESQUEMAS_IA, cuestionarioSchema, leerCuestionarioGuardado } from '../logicaNoPersistente/ia/esquemas';
import { esFuenteIA, type TipoMaterialIA } from '../logicaNoPersistente/ia/tipos';
import type { ColaEjecucion } from '../logicaNoPersistente/ia/colaEjecucion';
import { GeneradorMaterialIA } from '../logicaNoPersistente/ia/generadorMaterialIA';

interface Pendiente {
  idUsuario: number;
  idArchivo: number;
  tipo: TipoMaterialIA;
  proveedores: string[];
}

// Un cuestionario guardado viaja al front sin las respuestas correctas ni las explicaciones:
// así no se pueden ver antes de resolverlo.
function sinRespuestas(material: MaterialGuardado): MaterialGuardado {
  if (material.tipo !== 'cuestionario') return material;
  return { ...material, contenido: paraResolver(leerCuestionarioGuardado(material.contenido)) as never };
}

// Para las listas: un cuestionario que no se puede leer igual aparece (para poder eliminarlo),
// sin contenido, en lugar de romper la lista entera.
function sinRespuestasParaLista(material: MaterialGuardado): MaterialGuardado {
  try {
    return sinRespuestas(material);
  } catch {
    return { ...material, contenido: null as never };
  }
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
    private readonly obtenerCasoUso: ObtenerMaterialIA,
    private readonly eliminarCasoUso: EliminarMaterialIA,
    private readonly responderCasoUso: ResponderCuestionario,
    private readonly listarIntentosCasoUso: ListarIntentosCuestionario,
    private readonly editarMapaCasoUso: EditarMapaMentalIA,
  ) {}

  // Genera la propuesta. Resúmenes y mapas no se guardan hasta que el usuario los revisa en la
  // pantalla previa. Los cuestionarios NO tienen pantalla previa (se verían las respuestas):
  // se guardan acá y al front le llegan sin respuestas, listos para resolver.
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

    if (datos.tipo === 'cuestionario') {
      const guardado = await this.guardarCasoUso.ejecutar({
        idUsuario,
        idArchivo: archivo.id,
        tipo: 'cuestionario',
        contenido: cuestionarioSchema.parse(contenido),
        proveedores,
      });
      return {
        trabajoId: datos.trabajoId,
        idArchivo: archivo.id,
        fuente: archivo.nombre,
        tipo: datos.tipo,
        contenido: sinRespuestas(guardado).contenido,
        proveedores,
        idMaterialIA: guardado.idMaterialIA,
      };
    }

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
    const lista = await this.listarCasoUso.ejecutar(usuarioActual(), { idArchivo: datos.idArchivo, tipo: datos.tipo });
    return lista.map(sinRespuestasParaLista);
  }

  async obtener(datos: MaterialIADTO): Promise<MaterialGuardado> {
    return sinRespuestas(await this.obtenerCasoUso.ejecutar(usuarioActual(), datos.idMaterialIA));
  }

  async eliminar(datos: MaterialIADTO): Promise<void> {
    await this.eliminarCasoUso.ejecutar(usuarioActual(), datos.idMaterialIA);
  }

  async editarMapaMental(datos: EditarMapaMentalIADTO): Promise<MaterialGuardado> {
    return this.editarMapaCasoUso.ejecutar(usuarioActual(), datos.idMaterialIA, datos.contenido);
  }

  // Corrige en el main: las respuestas correctas recién llegan al front con el resultado.
  async responderCuestionario(datos: ResponderCuestionarioDTO) {
    return this.responderCasoUso.ejecutar(usuarioActual(), datos.idMaterialIA, datos.respuestas);
  }

  async listarIntentos(datos: MaterialIADTO): Promise<IntentoCuestionario[]> {
    return this.listarIntentosCasoUso.ejecutar(usuarioActual(), datos.idMaterialIA);
  }
}
