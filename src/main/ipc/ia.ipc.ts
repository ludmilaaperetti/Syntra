// src/main/ipc/ia.ipc.ts
import { ipcMain } from 'electron';
import { z } from 'zod';
import { ErrorClaves } from '../logicaNoPersistente/ia/proveedores/almacenClaves';
import { mapearConProgreso } from '../logicaNoPersistente/ia/colaEjecucion';
import { ErrorRouter, esAbort } from '../logicaNoPersistente/ia/errores';
import { fragmentarEnTextos } from '../logicaNoPersistente/ia/fragmentador';
import { armarUsuario } from '../logicaNoPersistente/ia/prompts';
import { NOMBRES_TAREAS, TAREAS_IA, type DefTarea } from '../logicaNoPersistente/ia/tareas';
import type { ServiciosIA } from '../logicaNoPersistente/ia';

// Todo lo que llega del renderer es DESCONFIABLE: se valida igual que la salida del modelo.
const PedidoGenerar = z.object({
  idTrabajo: z.string().uuid(),
  tarea: z.enum(NOMBRES_TAREAS),
  texto: z.string().min(1).max(2_000_000), // ya extraído (mammoth / pdf) y validado antes
  preferencias: z.string().max(2000).optional(),
});
const ProveedorOnline = z.enum(['luna', 'gemini']);
const ProveedorCualquiera = z.enum(['luna', 'gemini', 'gemma']);

/** Los Error NO viajan bien por IPC (se pierden propiedades): siempre devolvemos un objeto simple. */
type Resp<T> = { ok: true; dato: T } | { ok: false; causa: string; mensaje: string };

const fallo = (causa: string, e: unknown): Resp<never> => ({
  ok: false,
  causa,
  mensaje: e instanceof Error ? e.message : String(e),
});

export function registrarIpcIA({ claves, router, cola, ollama }: ServiciosIA): void {
  ipcMain.handle('ia:generar', async (_evento, crudo: unknown): Promise<Resp<unknown>> => {
    const parsed = PedidoGenerar.safeParse(crudo);
    if (!parsed.success) return fallo('pedido_invalido', parsed.error);
    const pedido = parsed.data;
    const def: DefTarea = TAREAS_IA[pedido.tarea]; // anotar el tipo evita que TS infiera una unión de esquemas

    try {
      const dato = await cola.add(pedido.idTrabajo, async (ctx) => {
        const fragmentos = fragmentarEnTextos(pedido.texto);
        return mapearConProgreso(fragmentos, ctx, async (frag) => {
          const r = await router.generar(pedido.tarea, {
            sistema: def.sistema,
            usuario: armarUsuario(frag, pedido.preferencias),
            esquema: def.esquema,
            esquemaJson: def.esquemaJson,
            signal: ctx.signal,
          });
          return { dato: r.dato, proveedor: r.proveedor };
        });
      });
      return { ok: true, dato }; // lista de { dato, proveedor } por fragmento: unir/deduplicar en la pantalla de revisión
    } catch (e) {
      if (esAbort(e)) return { ok: false, causa: 'cancelado', mensaje: 'Cancelado' };
      if (e instanceof ErrorRouter) return fallo('sin_proveedor', e);
      return fallo('desconocido', e);
    }
  });

  ipcMain.handle('ia:cancelar', (_e, id: unknown) => cola.cancelar(z.string().parse(id)));

  // Claves: el renderer puede GUARDAR y consultar si existe. Nunca LEERLA completa.
  ipcMain.handle('ia:guardarClave', (_e, proveedor: unknown, clave: unknown): Resp<true> => {
    try {
      claves.establecer(ProveedorOnline.parse(proveedor), z.string().min(8).max(300).parse(clave));
      return { ok: true, dato: true };
    } catch (e) {
      return fallo(e instanceof ErrorClaves ? e.codigo : 'pedido_invalido', e);
    }
  });
  ipcMain.handle('ia:tieneClave', (_e, proveedor: unknown) => claves.existe(ProveedorOnline.parse(proveedor)));
  ipcMain.handle('ia:claveEnmascarada', (_e, proveedor: unknown) => claves.enmascarada(ProveedorOnline.parse(proveedor)));
  ipcMain.handle('ia:borrarClave', (_e, proveedor: unknown) => {
    claves.borrar(ProveedorOnline.parse(proveedor));
    return true;
  });

  // Pantalla de Ajustes
  ipcMain.handle('ia:probarConexion', (_e, proveedor: unknown) =>
    router.probar(ProveedorCualquiera.parse(proveedor), AbortSignal.timeout(15_000)),
  ); // → { ok: true, ms } ó { ok: false, ms, causa }
  ipcMain.handle('ia:estadoOllama', () => ollama.estado()); // → { corriendo, modeloInstalado }
}