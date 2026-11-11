// src/main/logicaNoPersistente/ia/proveedores/proveedorLuna.ts  (Azure OpenAI / Foundry, GPT-6 Luna)
import OpenAI from 'openai';
import { ErrorProveedor, clasificar } from '../../logicaNoPersistente/ia/errores.js';
import type { PedidoCrudo, ProveedorModelo } from '../../logicaNoPersistente/ia/tipos.js';

export interface ConfigLuna {
  recurso: string; // "mi-recurso" → https://mi-recurso.openai.azure.com
  despliegue: string; // nombre de TU deployment (no el del modelo)
  obtenerClave: () => string | undefined; // viene de AlmacenClaves, nunca hardcodeada
}

export class ProveedorLuna implements ProveedorModelo {
  readonly id = 'luna';
  readonly tipo = 'online' as const;

  constructor(private readonly cfg: ConfigLuna) {}

  async disponible(): Promise<boolean> {
    return Boolean(this.cfg.obtenerClave()); // sin clave, ni lo intentamos
  }

  async generarJson(p: PedidoCrudo): Promise<string> {
    const apiKey = this.cfg.obtenerClave();
    if (!apiKey) throw new ErrorProveedor('sin_clave', this.id, 'Falta la clave de Azure');

    const cliente = new OpenAI({
      baseURL: `https://${this.cfg.recurso}.openai.azure.com/openai/v1/`,
      apiKey,
    });

    try {
      const r = await cliente.chat.completions.create(
        {
          model: this.cfg.despliegue,
          messages: [
            { role: 'system', content: p.sistema },
            { role: 'user', content: p.usuario },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'salida', strict: true, schema: p.esquemaJson },
          },
        },
        { signal: p.signal }, // 2.º argumento = opciones de la request
      );
      const texto = r.choices[0]?.message.content;
      if (!texto) throw new ErrorProveedor('salida_invalida', this.id, 'Respuesta vacía');
      return texto;
    } catch (e) {
      throw clasificar(e, this.id);
    }
  }
}