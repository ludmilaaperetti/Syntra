// src/main/logicaNoPersistente/ia/index.ts  — "raíz de composición": acá se arma todo
import { app, net, safeStorage } from 'electron';
import { join } from 'node:path';
import { AlmacenClaves } from './proveedores/almacenClaves';
import { ProveedorGemini } from './proveedores/proveedorGemini';
import { ProveedorLuna } from './proveedores/proveedorLuna';
import { ProveedorOllama } from './proveedores/proveedorOllama';
import { ColaEjecucion, type EventoProgreso } from './colaEjecucion';
import { RouterModelos } from './routerModelos';
import { TAREAS, type Tarea } from './tipos';

export interface OpcionesServiciosIA {
  /** Se llama en cada cambio de estado/progreso de un trabajo (el main lo manda a la ventana). */
  alProgreso?: (e: EventoProgreso) => void;
}

export function crearServiciosIA(opciones: OpcionesServiciosIA = {}) {
  // userData ya es distinto por instancia si arrancás con --user-data-dir o setPath (ver README)
  const claves = new AlmacenClaves(join(app.getPath('userData'), 'ia-claves.json'), safeStorage);

  // En desarrollo se permite caer al .env; empaquetada, solo la clave que cargó el usuario
  const clave = (id: string, envVar: string) => () => {
    try {
      return claves.obtener(id) ?? (app.isPackaged ? undefined : process.env[envVar]);
    } catch {
      return undefined; // clave ilegible: se trata como "sin clave"
    }
  };

  const ollama = new ProveedorOllama('gemma', {
    host: process.env.OLLAMA_HOST,
    modelo: process.env.OLLAMA_MODELO ?? 'COMPLETAR-con-ollama-list',
  });

  const proveedores = [
    new ProveedorLuna({
      recurso: process.env.AZURE_RECURSO ?? '',
      despliegue: process.env.AZURE_DESPLIEGUE ?? 'luna',
      obtenerClave: clave('luna', 'AZURE_OPENAI_API_KEY'),
    }),
    new ProveedorGemini({
      modelo: process.env.GEMINI_MODELO ?? 'COMPLETAR-con-el-id-vigente',
      obtenerClave: clave('gemini', 'GEMINI_API_KEY'),
    }),
    ollama,
  ];

  // Luna principal → Gemini alternativa → Gemma si no hay conexión (o fallan los dos)
  const porDefecto = ['luna', 'gemini', 'gemma'];
  const cadenas = Object.fromEntries(TAREAS.map((t) => [t, porDefecto])) as Record<Tarea, string[]>;

  const router = new RouterModelos(proveedores, {
    cadenas,
    hayInternet: () => net.isOnline(),
    reintentosSalida: 1,
    alEvento: (e) => console.log('[ia]', e), // luego: mandarlo a la UI para "usando Gemini…"
  });

  const cola = new ColaEjecucion(2, opciones.alProgreso);
  return { claves, router, cola, ollama };
}

export type ServiciosIA = ReturnType<typeof crearServiciosIA>;
