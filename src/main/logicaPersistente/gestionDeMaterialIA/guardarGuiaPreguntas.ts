// src/main/logicaPersistente/gestionDeMaterialIA/guardarGuiaPreguntas.ts
// Guarda la guía de preguntas ya corregida como un .docx dentro de Material.
// Misma idea que DocumentoSesionEstudio.crear (HTML → .docx → Archivos.crear). Siempre queda en la carpeta "guia"
// (bajo la raíz), que se crea si no existe.
import HTMLtoDOCX from '@turbodocx/html-to-docx';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Archivos } from '../../administracionDePersistencia/archivos';
import { Nodos } from '../../administracionDePersistencia/nodo';
import { Persistencia } from '../../persistencia/persistencia';
import { Archivo } from '../gestionMaterialEstudio/entidades';

// Tiene que coincidir con guiasPreguntasPage.tsx.
const NOMBRE_CARPETA_GUIAS = 'guia';
const ID_NODO_RAIZ = 1;

export interface DatosGuardarGuia {
  nombre: string;
  html: string;
}

export class GuardarGuiaPreguntas {
  constructor(
    private readonly archivos: Archivos,
    private readonly nodos: Nodos,
    private readonly persistencia: Persistencia,
  ) {}

  async ejecutar(datos: DatosGuardarGuia): Promise<Archivo> {
    const idPadre = await this.obtenerIdCarpeta();
    const docx = (await HTMLtoDOCX(datos.html || '<p></p>', null, {})) as Buffer;
    const carpeta = await mkdtemp(join(tmpdir(), 'guia-docx-'));
    const ruta = join(carpeta, 'contenido.docx');
    try {
      await writeFile(ruta, docx);
      return await this.archivos.crear({
        nombre: this.limpiarNombre(datos.nombre),
        extension: 'docx',
        rutaFisica: ruta,
        tamanio: docx.length,
        idPadre,
      });
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }

  private async obtenerIdCarpeta(): Promise<number> {
    const filas = await this.persistencia.ejecutar(
      `SELECT id_nodo FROM nodos WHERE nombre = $1 AND id_padre = $2 LIMIT 1`,
      [NOMBRE_CARPETA_GUIAS, ID_NODO_RAIZ],
    );
    if (filas.length > 0) return filas[0].id_nodo;
    const creada = await this.nodos.crear({ nombre: NOMBRE_CARPETA_GUIAS, idPadre: ID_NODO_RAIZ });
    return creada.id;
  }

  private limpiarNombre(nombre: string): string {
    const limpio = nombre.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 200);
    return limpio || 'Guía de preguntas';
  }
}