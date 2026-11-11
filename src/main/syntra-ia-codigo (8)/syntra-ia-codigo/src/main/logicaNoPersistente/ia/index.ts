// src/main/logicaNoPersistente/ia/index.ts  — "raíz de composición": acá se arma todo
import { app, net, safeStorage } from 'electron';
import { join } from 'node:path';
import { AlmacenClaves } from '../../servicios/ia/AlmacenClaves.js';
import { ProveedorGemini } from '../../servicios/ia/ProveedorGemini.js';
import { ProveedorLuna } from '../../servicios/ia/ProveedorLuna.js';
import { GestorOllama, normalizarHost, type EventoOllama } from '../../servicios/ia/GestorOllama.js';
import { ProveedorOllama } from '../../servicios/ia/ProveedorOllama.js';
import { ColaEjecucion, type EventoProgreso } from './ColaEjecucion.js';
import { RouterModelos } from './RouterModelos.js';
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
  const modeloOllama = process.env.OLLAMA_MODELO ?? 'gemma4:e2b'; // por defecto el liviano; se puede cambiar en .env
  const ollama = new ProveedorOllama('gemma', { host: hostOllama, modelo: modeloOllama });
  // Al abrir la app: inicia Ollama y DESCARGA el modelo si falta (~4,6 GB, una sola vez).
  // Para desactivarlo: OLLAMA_AUTO_DESCARGA=0 en el .env (entonces avisa 'falta_modelo' y espera).
  const gestorOllama = new GestorOllama({
    host: hostOllama,
    modelo: modeloOllama,
    estado: () => ollama.estado(),
    alEvento: opciones.alOllama,
    autoDescargar: process.env.OLLAMA_AUTO_DESCARGA !== '0',
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
