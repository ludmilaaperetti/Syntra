import { ipcMain } from 'electron';
import { MaterialIA } from '../administracionDePersistencia/materialIA';
import {
  generarMaterialIASchema,
  guardarMaterialIASchema,
  listarMaterialesIASchema,
  trabajoIASchema,
} from '../logicaPersistente/gestionDeMaterialIA/dto';
import { esCancelacion } from '../logicaNoPersistente/ia/contratos';

export function registerMaterialIAIpc(
  materialIA: MaterialIA,
  emitir: (canal: string, datos: unknown) => void,
): void {
  materialIA.alProgreso((progreso) => emitir('ia:progreso', progreso));

  // Cancelar no es un error: se devuelve { ok: false, cancelado: true } para que el front no muestre un cartel.
  ipcMain.handle('ia:generar', async (_event, datos: unknown) => {
    const validado = generarMaterialIASchema.parse(datos);
    try {
      return { ok: true, propuesta: await materialIA.generar(validado) };
    } catch (error) {
      if (esCancelacion(error)) return { ok: false, cancelado: true };
      throw error;
    }
  });

  ipcMain.handle('ia:cancelar', async (_event, datos: unknown) =>
    materialIA.cancelar(trabajoIASchema.parse(datos))
  );

  ipcMain.handle('ia:descartar', async (_event, datos: unknown) =>
    materialIA.descartar(trabajoIASchema.parse(datos))
  );

  ipcMain.handle('ia:guardar', async (_event, datos: unknown) =>
    materialIA.guardar(guardarMaterialIASchema.parse(datos))
  );

  ipcMain.handle('ia:listar', async (_event, datos: unknown) =>
    materialIA.listar(listarMaterialesIASchema.parse(datos ?? {}))
  );
}
