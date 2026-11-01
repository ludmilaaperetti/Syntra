import { detener, hablar } from './narrador';

export type Bloque = { texto: string; esTitulo: boolean };

let bloques: Bloque[] = [];
let indice = 0;
let leyendo = false;

// Los párrafos largos se parten en oraciones: Chromium corta las frases muy largas.
function partir(lista: Bloque[]): Bloque[] {
  return lista.flatMap((b) =>
    b.esTitulo
      ? [b]
      : b.texto.split(/(?<=[.!?])\s+/).map((texto) => ({ texto, esTitulo: false }))
  ).filter((b) => b.texto.trim());
}

function leerActual(): void {
  if (indice >= bloques.length) {
    leyendo = false;
    hablar('Fin del documento.');
    return;
  }
  leyendo = true;
  const { texto, esTitulo } = bloques[indice];
  hablar(esTitulo ? `Título: ${texto}` : texto, () => {
    indice++;
    leerActual();
  });
}

export function empezarLectura(nuevos: Bloque[]): void {
  bloques = partir(nuevos);
  indice = 0;
  if (!bloques.length) return hablar('Este archivo no tiene texto para leer.');
  leerActual();
}

export function pausarLectura(): void {
  if (!leyendo) return;
  leyendo = false;
  hablar('Pausado');
}

export function seguirLectura(): void {
  if (!leyendo && indice < bloques.length) leerActual();
}

export function siguienteTitulo(): void {
  const proximo = bloques.findIndex((b, i) => i > indice && b.esTitulo);
  if (proximo === -1) return hablar('No hay más títulos.');
  indice = proximo;
  leerActual();
}

export function detenerLectura(): void {
  leyendo = false;
  bloques = [];
  indice = 0;
  detener();
}