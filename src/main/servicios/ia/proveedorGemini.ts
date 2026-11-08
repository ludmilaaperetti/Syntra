// src/main/servicios/ia/ProveedorGemini.ts
import { GoogleGenAI } from '@google/genai';
import { ErrorProveedor, clasificar } from '../../logicaNoPersistente/gestionDeIa/errores.js';
import type { PedidoCrudo, ProveedorModelo } from '../../logicaNoPersistente/gestionDeIa/tipos.js';

export interface ConfigGemini {
  modelo: string; // el id vigente de un modelo Flash (ver ai.google.dev/gemini-api/docs/models)
  obtenerClave: () => string | undefined;
}

export class ProveedorGemini implements ProveedorModelo {
  readonly id = 'gemini';
  readonly tipo = 'online' as const;

  constructor(private readonly cfg: ConfigGemini) {}

  async disponible(): Promise<boolean> {
    return Boolean(this.cfg.obtenerClave());
  }

  async generarJson(p: PedidoCrudo): Promise<string> {
    const apiKey = this.cfg.obtenerClave();
    if (!apiKey) throw new ErrorProveedor('sin_clave', this.id, 'Falta la clave de Gemini');

    const ai = new GoogleGenAI({ apiKey });
    try {
      const r = await ai.models.generateContent({
        model: this.cfg.modelo,
        contents: p.usuario,
        config: {
          systemInstruction: p.sistema,
          responseMimeType: 'application/json',
          responseJsonSchema: p.esquemaJson,
          abortSignal: p.signal, // verificá que tu versión del SDK lo soporte
        },
      });
      if (!r.text) throw new ErrorProveedor('salida_invalida', this.id, 'Respuesta vacía');
      return r.text;
    } catch (e) {
      throw clasificar(e, this.id);
    }
  }
}
