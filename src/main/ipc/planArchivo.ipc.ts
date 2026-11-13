// src/main/ipc/planArchivo.ipc.ts
import { ipcMain } from 'electron';
import { stat } from 'node:fs/promises';
import { basename, extname, isAbsolute } from 'node:path';
import { z } from 'zod';
import { extraerTexto } from '../logicaNoPersistente/ia/extractorTexto.js';
import { GeneradorMaterialIA } from '../logicaNoPersistente/ia/generadorMaterialIA.js';
import type { ColaEjecucion } from '../logicaNoPersistente/ia/colaEjecucion.js';

const EXTENSIONES = new Set(['pdf', 'docx', 'txt', 'md']);
const TAMANIO_MAXIMO = 25 * 1024 * 1024; // 25 MB

const pedidoSchema = z.object({ ruta: z.string().min(1).max(1000) });
const pedidoIASchema = z.object({
  trabajoId: z.string().min(1).max(100),
  ruta: z.string().min(1).max(1000),
  prompt: z.string().min(1).max(20000),
});

async function validarArchivo(ruta: string): Promise<string> {
  if (!isAbsolute(ruta)) throw new Error('No se pudo leer el archivo elegido.');
  const extension = extname(ruta).slice(1).toLowerCase();
  if (!EXTENSIONES.has(extension)) {
    throw new Error('Formato no soportado. Usá un PDF, un Word (.docx) o un texto (.txt).');
  }
  const info = await stat(ruta);
  if (!info.isFile() || info.size > TAMANIO_MAXIMO) {
    throw new Error('El archivo no es válido o pesa más de 25 MB.');
  }
  return extension;
}

export function registrarIpcPlanArchivo(generador: GeneradorMaterialIA, cola: ColaEjecucion): void {
  ipcMain.handle('materias:textoDePlan', async (_e, datos: unknown) => {
    const { ruta } = pedidoSchema.parse(datos);
    const extension = await validarArchivo(ruta);

    try {
      const { texto } = await extraerTexto(ruta, extension);
      if (!texto.trim()) {
        throw new Error('El archivo no tiene texto seleccionable.');
      }
      return { nombre: basename(ruta), texto };
    } catch (e) {
      // Si es un PDF escaneado (sin texto seleccionable), permitimos que la app sepa 
      // que debe usar la carga por IA en lugar de romper con un error bloqueante.
      throw new Error('El archivo no tiene texto seleccionable (¿es un PDF escaneado?). Usá la carga por IA.');
    }
  });

  ipcMain.handle('materias:transcribirPlanIA', async (_e, datos: unknown) => {
    const { trabajoId, ruta, prompt } = pedidoIASchema.parse(datos);
    let extension: string;
    try {
      extension = await validarArchivo(ruta);
    } catch (e) {
      return { ok: false, causa: 'archivo', mensaje: e instanceof Error ? e.message : 'Archivo no válido.' };
    }

    try {
      const fuente = {
        ruta,
        extension,
        nombre: basename(ruta),
      };

      const controller = new AbortController();
      if (typeof (cola as any).registrar === 'function') {
        (cola as any).registrar(trabajoId, controller);
      }

      const ctx = {
        trabajoId,
        signal: controller.signal,
      };

      // Si es un PDF escaneado, interceptamos el error interno de extraccion de texto 
      // para evitar que el generador falle, permitiendo que el modelo procese el archivo.
      let resultado;
      try {
        resultado = await generador.generar(fuente, 'materias', ctx, prompt);
      } catch (err: any) {
        // Si falla porque no tiene texto digital, simulamos un texto base o dejamos que la IA procese la imagen
        if (err?.codigo === 'SIN_TEXTO' && extension === 'pdf') {
          // Proveemos un texto temporal o manejador para que la IA lea el archivo escaneado
          resultado = await generador.generar(
            { ...fuente, extension: 'pdf' }, 
            'materias', 
            ctx, 
            `${prompt}\n\n[Nota: Este documento es un PDF escaneado, transcribe su contenido directamente desde la imagen].`
          );
        } else {
          throw err;
        }
      }

      const textoPlano = typeof resultado.contenido === 'string'
        ? resultado.contenido
        : JSON.stringify(resultado.contenido, null, 2);

      return {
        ok: true,
        nombre: basename(ruta),
        texto: textoPlano,
        proveedores: resultado.proveedores,
      };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Falló la transcripción con IA.';
      return { ok: false, causa: /cancel/i.test(mensaje) ? 'cancelado' : 'ia', mensaje };
    }
  });
}