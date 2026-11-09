import { ipcMain } from 'electron';
import { MaterialIA } from '../administracionDePersistencia/materialIA';
import {
  generarMaterialIASchema,
  guardarMaterialIASchema,
  listarMaterialesIASchema,
  trabajoIASchema,
} from '../logicaPersistente/gestionDeMaterialIA/dto';
import { esAbort } from '../logicaNoPersistente/ia/errores';

// Material con IA: generar desde un archivo → pantalla previa → guardar.
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
}
