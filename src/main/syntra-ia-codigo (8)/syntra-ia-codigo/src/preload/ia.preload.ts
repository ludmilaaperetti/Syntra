// src/preload/ia.preload.ts
// Se importa desde tu preload/index.ts y se suma a window.api (ver README). Nunca se expone ipcRenderer entero.
import { ipcRenderer } from 'electron';
// Solo el TIPO (se borra al compilar): así agregar una tarea no obliga a tocar el preload
import type { TareaImplementada } from '../main/logicaNoPersistente/ia/tareasIA.js';

import type { EventoOllama } from '../main/servicios/ia/GestorOllama.js';
export type { EventoOllama };

export type RespuestaIA<T> = { ok: true; dato: T } | { ok: false; causa: string; mensaje: string };
export interface ResultadoIA<T> {
  contenido: T; // el resultado ya combinado y validado
  proveedores: string[]; // quién respondió: ['gemini'], ['gemma'], ['gemini', 'gemma']...
}

export interface EventoProgresoIA {
  id: string;
  estado: 'en_cola' | 'ejecutando' | 'terminado' | 'cancelado' | 'error';
  hechas?: number;
  total?: number;
}

export const iaApi = {
  generar: <T = unknown>(pedido: {
    idTrabajo: string;
    tarea: TareaImplementada;
    texto: string;
    preferencias?: string;
  }) => ipcRenderer.invoke('ia:generar', pedido) as Promise<RespuestaIA<ResultadoIA<T>>>,
  cancelar: (idTrabajo: string) => ipcRenderer.invoke('ia:cancelar', idTrabajo),

  guardarClave: (proveedor: 'luna' | 'gemini', clave: string) => ipcRenderer.invoke('ia:guardarClave', proveedor, clave),
  tieneClave: (proveedor: 'luna' | 'gemini') => ipcRenderer.invoke('ia:tieneClave', proveedor),
  claveEnmascarada: (proveedor: 'luna' | 'gemini') => ipcRenderer.invoke('ia:claveEnmascarada', proveedor),
  borrarClave: (proveedor: 'luna' | 'gemini') => ipcRenderer.invoke('ia:borrarClave', proveedor),

  probarConexion: (proveedor: 'luna' | 'gemini' | 'gemma') => ipcRenderer.invoke('ia:probarConexion', proveedor),
  estadoOllama: () => ipcRenderer.invoke('ia:estadoOllama'),

  // Ollama (estado, descarga del modelo)
  ollamaUltimo: () => ipcRenderer.invoke('ia:ollama:ultimo') as Promise<EventoOllama | null>,
  ollamaDescargar: () => ipcRenderer.invoke('ia:ollama:descargar') as Promise<{ ok: true } | { ok: false; mensaje: string }>,
  ollamaCancelar: () => ipcRenderer.invoke('ia:ollama:cancelar'),
  ollamaReintentar: () => ipcRenderer.invoke('ia:ollama:reintentar'),
  onOllama: (cb: (e: EventoOllama) => void) => {
    const h = (_: unknown, e: EventoOllama) => cb(e);
    ipcRenderer.on('ia:ollama', h);
    return () => ipcRenderer.removeListener('ia:ollama', h);
  },

  /** Devuelve la función para desuscribirse: llamala al desmontar el componente. */
  onProgreso: (cb: (e: EventoProgresoIA) => void) => {
    const h = (_: unknown, e: EventoProgresoIA) => cb(e);
    ipcRenderer.on('ia:progreso', h);
    return () => ipcRenderer.removeListener('ia:progreso', h);
  },
};

export type ApiIA = typeof iaApi;
