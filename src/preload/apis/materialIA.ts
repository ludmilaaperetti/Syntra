import { ipcRenderer, type IpcRendererEvent } from 'electron';

// Generar con IA → pantalla previa → guardar.
export const materialIAApi = {
  generarMaterialIA: (datos: unknown) => ipcRenderer.invoke('ia:generar', datos),
  cancelarMaterialIA: (datos: unknown) => ipcRenderer.invoke('ia:cancelar', datos),
  descartarMaterialIA: (datos: unknown) => ipcRenderer.invoke('ia:descartar', datos),
  guardarMaterialIA: (datos: unknown) => ipcRenderer.invoke('ia:guardar', datos),
  listarMaterialesIA: (datos?: unknown) => ipcRenderer.invoke('ia:listar', datos),

  alProgresoIA: (callback: (progreso: unknown) => void) => {
    const manejador = (_event: IpcRendererEvent, progreso: unknown) => callback(progreso);
    ipcRenderer.on('ia:progreso', manejador);
    return () => ipcRenderer.removeListener('ia:progreso', manejador);
  },
};
