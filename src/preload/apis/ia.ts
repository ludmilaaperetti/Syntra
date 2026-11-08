import { ipcRenderer } from 'electron';

export interface EventoProgresoIA {
  id: string;
  estado: 'en_cola' | 'ejecutando' | 'terminado' | 'cancelado' | 'error';
  hechas?: number;
  total?: number;
}

export const iaApi = {
  generar: (pedido: {
    idTrabajo: string;
    tarea: 'resumen' | 'flashcards';
    texto: string;
    preferencias?: string;
  }) => ipcRenderer.invoke('ia:generar', pedido),
  cancelar: (idTrabajo: string) => ipcRenderer.invoke('ia:cancelar', idTrabajo),

  guardarClave: (proveedor: 'luna' | 'gemini', clave: string) => ipcRenderer.invoke('ia:guardarClave', proveedor, clave),
  tieneClave: (proveedor: 'luna' | 'gemini') => ipcRenderer.invoke('ia:tieneClave', proveedor),
  claveEnmascarada: (proveedor: 'luna' | 'gemini') => ipcRenderer.invoke('ia:claveEnmascarada', proveedor),
  borrarClave: (proveedor: 'luna' | 'gemini') => ipcRenderer.invoke('ia:borrarClave', proveedor),

  probarConexion: (proveedor: 'luna' | 'gemini' | 'gemma') => ipcRenderer.invoke('ia:probarConexion', proveedor),
  estadoOllama: () => ipcRenderer.invoke('ia:estadoOllama'),

  /** Devuelve la función para desuscribirse: llamala al desmontar el componente. */
  onProgreso: (cb: (e: EventoProgresoIA) => void) => {
    const h = (_: unknown, e: EventoProgresoIA) => cb(e);
    ipcRenderer.on('ia:progreso', h);
    return () => ipcRenderer.removeListener('ia:progreso', h);
  },
};

export type ApiIA = typeof iaApi;
