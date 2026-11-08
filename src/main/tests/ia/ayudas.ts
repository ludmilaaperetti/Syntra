// Ayudas compartidas por los tests de IA: proveedores falsos que no tocan la red.
import { RouterModelos, type EventoRouter } from '../../logicaNoPersistente/gestionDeIa/routerModelos.js';
import type { PedidoCrudo, ProveedorModelo } from '../../logicaNoPersistente/gestionDeIa/tipos.js';

export function falso(
  id: string,
  tipo: 'online' | 'local',
  respuestas: (string | Error)[],
  disponible = true,
): ProveedorModelo & { llamadas: number } {
  const p = {
    id,
    tipo,
    llamadas: 0,
    disponible: async () => disponible,
    generarJson: async (_: PedidoCrudo) => {
      const r = respuestas[Math.min(p.llamadas, respuestas.length - 1)]!;
      p.llamadas++;
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return p;
}

export const esquema = {
  parse(d: unknown): { x: number } {
    if (typeof d === 'object' && d && typeof (d as { x?: unknown }).x === 'number') return d as { x: number };
    throw new Error('x debe ser número');
  },
};
export const pedido = (signal?: AbortSignal) => ({ sistema: 's', usuario: 'u', esquema, esquemaJson: {}, signal });
export const cadenas = { resumen: ['luna', 'gemini', 'gemma'] } as never;
export const router = (ps: ProveedorModelo[], online = true, eventos: EventoRouter[] = []) =>
  new RouterModelos(ps, { cadenas, hayInternet: () => online, alEvento: (e) => eventos.push(e) });

