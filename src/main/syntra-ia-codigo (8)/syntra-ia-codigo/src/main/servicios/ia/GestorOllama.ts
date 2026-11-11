// src/main/servicios/ia/GestorOllama.ts
// Deja a Ollama listo cuando arranca la app: lo inicia si está instalado pero apagado y, si falta el
// modelo, lo descarga (solo con permiso: son varios GB). NO instala Ollama: eso es una vez por compu.
import { spawn, type ChildProcess } from 'node:child_process';

export type EventoOllama =
  | { tipo: 'iniciando' }
  | { tipo: 'listo' }
  | { tipo: 'no_instalado' } // el comando `ollama` no existe en esta compu
  | { tipo: 'no_arranco' } // existe pero no respondió a tiempo
  | { tipo: 'falta_modelo' } // corre, pero el modelo no está descargado
  | { tipo: 'descargando'; estado: string; porcentaje: number | null }
  | { tipo: 'error'; mensaje: string };

export interface OpcionesGestorOllama {
  host: string; // ya normalizado: http://127.0.0.1:11434
  modelo: string; // gemma4:e2b
  estado: () => Promise<{ corriendo: boolean; modeloInstalado: boolean }>;
  alEvento?: (e: EventoOllama) => void;
  /** Descargar el modelo solo, sin preguntar (~4,6 GB). Default false acá; index.ts lo activa. */
  autoDescargar?: boolean;
  lanzar?: () => ChildProcess; // inyectable para tests
  esperaArranqueMs?: number; // default 15 s
  pausaMs?: number; // default 500 ms
}

/** OLLAMA_HOST suele escribirse sin "http://" (ej. 127.0.0.1:11434) o como 0.0.0.0. */
export function normalizarHost(valor?: string): string {
  const v = (valor ?? '').trim();
  if (!v) return 'http://127.0.0.1:11434';
  const conEsquema = /^https?:\/\//i.test(v) ? v : `http://${v}`;
  return conEsquema.replace('//0.0.0.0', '//127.0.0.1').replace(/\/+$/, '');
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class GestorOllama {
  private hijo: ChildProcess | null = null; // solo si NOSOTROS lo iniciamos
  private descarga: AbortController | null = null;
  /** Último estado conocido: la pantalla lo consulta al abrir (puede haberse perdido el evento). */
  ultimo: EventoOllama | null = null;

  constructor(private readonly o: OpcionesGestorOllama) {}

  private emitir(e: EventoOllama): void {
    this.ultimo = e;
    this.o.alEvento?.(e);
  }

  /** Para llamar al arrancar SIN await: nunca lanza ni frena la app. */
  async preparar(): Promise<void> {
    try {
      this.emitir({ tipo: 'iniciando' });
      const arranque = await this.asegurarCorriendo();
      if (arranque !== 'ok') return this.emitir({ tipo: arranque });

      if ((await this.o.estado()).modeloInstalado) return this.emitir({ tipo: 'listo' });
      if (this.o.autoDescargar) {
        await this.descargarModelo();
        return;
      }
      this.emitir({ tipo: 'falta_modelo' });
    } catch (e) {
      this.emitir({ tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Si Ollama no responde, lo inicia (`ollama serve`) y espera a que conteste. */
  async asegurarCorriendo(): Promise<'ok' | 'no_instalado' | 'no_arranco'> {
    if ((await this.o.estado()).corriendo) return 'ok';

    const lanzar = this.o.lanzar ?? (() => spawn('ollama', ['serve'], { stdio: 'ignore', windowsHide: true }));
    let hijo: ChildProcess;
    try {
      hijo = lanzar();
    } catch {
      return 'no_instalado';
    }
    let noInstalado = false;
    let salio = false;
    // Sin este handler, un "ollama" inexistente tira la app abajo (evento 'error' sin escuchar).
    hijo.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') noInstalado = true;
      else salio = true;
    });
    hijo.on('exit', () => {
      salio = true;
    });
    this.hijo = hijo;

    const limite = Date.now() + (this.o.esperaArranqueMs ?? 15_000);
    while (Date.now() < limite) {
      if (noInstalado) {
        this.hijo = null;
        return 'no_instalado';
      }
      if (salio) break;
      if ((await this.o.estado()).corriendo) return 'ok';
      await dormir(this.o.pausaMs ?? 500);
    }
    this.detener(); // lo que iniciamos y no respondió, no se deja huérfano
    return 'no_arranco';
  }

  /** Descarga el modelo con progreso. Se puede cancelar con cancelarDescarga(). */
  async descargarModelo(): Promise<{ ok: true } | { ok: false; mensaje: string }> {
    if (this.descarga) return { ok: false, mensaje: 'Ya hay una descarga en curso' };
    const control = new AbortController();
    this.descarga = control;
    let ultimoPct = -1;
    let ultimoEstado = '';

    const procesar = (linea: string): void => {
      if (!linea.trim()) return;
      let j: { status?: string; total?: number; completed?: number; error?: string };
      try {
        j = JSON.parse(linea);
      } catch {
        return; // línea cortada o ruido: se ignora
      }
      if (j.error) throw new Error(j.error);
      const pct = j.total && j.completed !== undefined ? Math.round((j.completed / j.total) * 100) : null;
      const estado = j.status ?? '';
      // Se avisa solo si cambió algo: Ollama manda cientos de líneas por segundo
      if (pct === ultimoPct && estado === ultimoEstado) return;
      ultimoPct = pct ?? -1;
      ultimoEstado = estado;
      this.emitir({ tipo: 'descargando', estado, porcentaje: pct });
    };

    try {
      this.emitir({ tipo: 'descargando', estado: 'conectando', porcentaje: null });
      const r = await fetch(`${this.o.host}/api/pull`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.o.modelo, stream: true }),
        signal: control.signal,
      });
      if (!r.ok || !r.body) throw new Error(`Ollama respondió ${r.status}`);

      const lector = r.body.getReader();
      const decodificador = new TextDecoder();
      let resto = '';
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        resto += decodificador.decode(value, { stream: true });
        const lineas = resto.split('\n');
        resto = lineas.pop() ?? '';
        lineas.forEach(procesar);
      }
      procesar(resto);
      this.emitir({ tipo: 'listo' });
      return { ok: true };
    } catch (e) {
      if (control.signal.aborted) {
        this.emitir({ tipo: 'falta_modelo' });
        return { ok: false, mensaje: 'Descarga cancelada' };
      }
      const mensaje = e instanceof Error ? e.message : String(e);
      this.emitir({ tipo: 'error', mensaje });
      return { ok: false, mensaje };
    } finally {
      this.descarga = null;
    }
  }

  cancelarDescarga(): void {
    this.descarga?.abort();
  }

  /** Al cerrar la app: apaga SOLO el Ollama que iniciamos nosotros (no el que ya estaba corriendo). */
  detener(): void {
    this.cancelarDescarga();
    this.hijo?.kill();
    this.hijo = null;
  }
}
