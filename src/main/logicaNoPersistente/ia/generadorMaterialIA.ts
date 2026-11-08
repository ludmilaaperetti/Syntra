import type { ZodType } from 'zod';
import { COMBINAR, ESQUEMAS_IA, type ContenidoPorTipo } from './esquemas';
import type { TipoMaterialIA } from './tipos';
import type { ContextoTrabajo, RouterIA } from './contratos';
import { extraerTexto } from './extractorTexto';
import { fragmentar, type OpcionesFragmentador } from './fragmentador';
import { generarConEsquema } from './generarConEsquema';
import { armarPrompt, SISTEMA_IA } from './prompts';

export interface ResultadoGeneracion<T extends TipoMaterialIA = TipoMaterialIA> {
  contenido: ContenidoPorTipo[T];
  proveedores: string[];
}


export class GeneradorMaterialIA {
  constructor(
    private readonly router: RouterIA,
    private readonly opcionesFragmentador?: OpcionesFragmentador,
  ) {}

  async generar<T extends TipoMaterialIA>(
    fuente: { ruta: string; extension: string; nombre: string },
    tipo: T,
    ctx: ContextoTrabajo,
  ): Promise<ResultadoGeneracion<T>> {
    ctx.reportar(0, 0, { mensaje: 'Leyendo el archivo…' });
    const { texto } = await extraerTexto(fuente.ruta, fuente.extension);

    const fragmentos = fragmentar(texto, this.opcionesFragmentador);
    const total = fragmentos.length;
    const partes: ContenidoPorTipo[T][] = [];
    const usados = new Set<string>();

    for (const [i, fragmento] of fragmentos.entries()) {
      ctx.reportar(i + 1, total, { mensaje: `Procesando parte ${i + 1} de ${total}` });
      const { datos, proveedor } = await generarConEsquema(this.router, {
        prompt: armarPrompt(tipo, fragmento, i + 1, total),
        sistema: SISTEMA_IA,
        schema: ESQUEMAS_IA[tipo] as unknown as ZodType<ContenidoPorTipo[T]>,
        nombreSchema: tipo,
        signal: ctx.signal,
        temperatura: 0.3,
        alResponder: (p) => ctx.reportar(i + 1, total, { proveedor: p }),
      });
      usados.add(proveedor);
      partes.push(datos);
    }

    const combinar = COMBINAR[tipo] as (p: ContenidoPorTipo[T][], titulo: string) => ContenidoPorTipo[T];
    return { contenido: combinar(partes, fuente.nombre), proveedores: [...usados] };
  }
}
