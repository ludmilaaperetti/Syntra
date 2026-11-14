// src/main/logicaNoPersistente/ia/asistenteChat.ts
// Chat con IA: arma el pedido con el historial y lo manda por el router (Luna → Gemini → Gemma).
// No guarda nada: eso lo hace administracionDePersistencia/chatIA.ts.
import { armarChat, type MensajeHistorial } from './prompts';
import type { RouterModelos } from './routerModelos';
import { TAREAS_IA } from './tareas';
import { respuestaChatSchema } from './esquemas';

export interface RespuestaAsistente {
  texto: string;
  proveedor: string; // 'luna' | 'gemini' | 'gemma'
}

export class AsistenteChat {
  constructor(private readonly router: Pick<RouterModelos, 'generar'>) {}

  async responder(historial: MensajeHistorial[], mensaje: string, signal?: AbortSignal): Promise<RespuestaAsistente> {
    const r = await this.router.generar('chat', {
      sistema: TAREAS_IA.chat.sistema,
      usuario: armarChat(historial, mensaje),
      esquema: respuestaChatSchema,
      esquemaJson: TAREAS_IA.chat.esquemaJson,
      signal,
    });
    signal?.throwIfAborted(); // si canceló mientras llegaba la respuesta, no se usa
    return { texto: r.dato.respuesta, proveedor: r.proveedor };
  }
}
