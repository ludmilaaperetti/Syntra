import { ipcMain } from 'electron';
import { MaterialIA } from '../administracionDePersistencia/materialIA';
import {
  editarMapaMentalIASchema,
  generarMaterialIASchema,
  guardarMaterialIASchema,
  listarMaterialesIASchema,
  materialIASchema,
  responderCuestionarioSchema,
  trabajoIASchema,
} from '../logicaPersistente/gestionDeMaterialIA/dto';
import { esAbort } from '../logicaNoPersistente/ia/errores';

// Material con IA: generar desde un archivo → pantalla previa → guardar (los cuestionarios se guardan solos).
// Después: ver, eliminar y resolver los cuestionarios.
// El progreso ('ia:progreso') y cancelar ('ia:cancelar') son los de toda la IA: hay una sola cola.
export function registerMaterialIAIpc(materialIA: MaterialIA): void {
  // Cancelar no es un error: se devuelve { ok: false, cancelado: true } para que el front no muestre un cartel.
  ipcMain.handle('materialIA:generar', async (_event, datos: unknown) => {
    const validado = generarMaterialIASchema.parse(datos);
    try {
      return { ok: true, propuesta: await materialIA.generar(validado) };
    } catch (error) {
      if (esAbort(error)) return { ok: false, cancelado: true };
      throw error;
    }
  });

  ipcMain.handle('materialIA:descartar', async (_event, datos: unknown) =>
    materialIA.descartar(trabajoIASchema.parse(datos))
  );

  ipcMain.handle('materialIA:guardar', async (_event, datos: unknown) =>
    materialIA.guardar(guardarMaterialIASchema.parse(datos))
  );

  ipcMain.handle('materialIA:listar', async (_event, datos: unknown) =>
    materialIA.listar(listarMaterialesIASchema.parse(datos ?? {}))
  );

  ipcMain.handle('materialIA:obtener', async (_event, datos: unknown) =>
    materialIA.obtener(materialIASchema.parse(datos))
  );

  // Mapas mentales: guardar lo que el usuario editó (ideas nuevas, eliminadas o cambiadas).
  ipcMain.handle('materialIA:editarMapaMental', async (_event, datos: unknown) =>
    materialIA.editarMapaMental(editarMapaMentalIASchema.parse(datos))
  );

  ipcMain.handle('materialIA:eliminar', async (_event, datos: unknown) => {
    await materialIA.eliminar(materialIASchema.parse(datos));
    return true;
  });

  // Cuestionarios: se corrige en el main y se guarda el intento.
  ipcMain.handle('materialIA:responderCuestionario', async (_event, datos: unknown) =>
    materialIA.responderCuestionario(responderCuestionarioSchema.parse(datos))
  );

  ipcMain.handle('materialIA:listarIntentos', async (_event, datos: unknown) =>
    materialIA.listarIntentos(materialIASchema.parse(datos))
  );
}
