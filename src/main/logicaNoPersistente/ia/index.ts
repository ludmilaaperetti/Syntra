// src/main/logicaNoPersistente/ia/index.ts  — "raíz de composición": acá se arma todo
import { app, net, safeStorage } from 'electron';
import { join } from 'node:path';
import { AlmacenClaves } from '../../servicios/ia/almacenClaves.js';
import { ProveedorGemini } from '../../servicios/ia/proveedorGemini.js';
import { ProveedorLuna } from '../../servicios/ia/proveedorLuna.js';
import { ProveedorOllama } from '../../servicios/ia/proveedorOllama.js';
import { ColaEjecucion, type EventoProgreso } from './colaEjecucion.js';
import { RouterModelos } from './routerModelos.js';
import { TAREAS, type Tarea } from './tipos.js';

export interface OpcionesServiciosIA {
  /** Se llama en cada cambio de estado/progreso de un trabajo (el main lo manda a la ventana). */
  alProgreso?: (e: EventoProgreso) => void;
  /** Estado de Ollama (iniciando, listo, falta_modelo, descargando...) para mostrarlo en la pantalla. */
  alOllama?: (e: EventoOllama) => void;
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

  // OLLAMA_HOST suele escribirse sin "http://": se normaliza para no romper el fetch
  const hostOllama = normalizarHost(process.env.OLLAMA_HOST);
  const modeloOllama = process.env.OLLAMA_MODELO ?? 'COMPLETAR-con-ollama-list';
  const ollama = new ProveedorOllama('gemma', { host: hostOllama, modelo: modeloOllama });
  // Inicia Ollama y descarga el modelo si falta. OLLAMA_AUTO_DESCARGA=1 → sin preguntar (solo desarrollo)
  const gestorOllama = new GestorOllama({
    host: hostOllama,
    modelo: modeloOllama,
    estado: () => ollama.estado(),
    alEvento: opciones.alOllama,
    autoDescargar: process.env.OLLAMA_AUTO_DESCARGA === '1',
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
  return { claves, router, cola, ollama, gestorOllama };
}

export type ServiciosIA = ReturnType<typeof crearServiciosIA>;