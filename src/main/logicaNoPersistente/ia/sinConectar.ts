import type { ColaIA, RouterIA } from './contratos';

// Lugar reservado para las piezas de otro integrante (Router + ModelProvider y la cola).
// Mientras no estén, la app compila y arranca; al tocar "Generar con IA" aparece este aviso.
// Cuando estén, en index.ts se cambian estos dos por las implementaciones reales.

const aviso = (pieza: string) =>
  new Error(`Todavía no está conectada la pieza "${pieza}" de la IA. Ver logicaNoPersistente/ia/LEEME.md.`);

export const routerSinConectar: RouterIA = {
  generar: async () => {
    throw aviso('Router + ModelProvider');
  },
};

export const colaSinConectar: ColaIA = {
  encolar: async () => {
    throw aviso('Cola con cancelación');
  },
  cancelar: () => false,
  cancelarTodo: () => {},
  alProgreso: () => {},
};
