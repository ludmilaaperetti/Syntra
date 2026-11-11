// src/main/logicaNoPersistente/ia/fragmentar.ts
// Versión simple: corta por párrafos sin pasar de `maxCaracteres`. Reemplazala por tu
// Fragmentador (por títulos / tokens) cuando lo tengas; la firma puede quedar igual.

export function fragmentarSimple(texto: string, maxCaracteres = 12_000): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];
  const salida: string[] = [];
  let actual = '';

  const cerrar = () => {
    if (actual.trim()) salida.push(actual.trim());
    actual = '';
  };

  for (const parrafo of limpio.split(/\n{2,}/)) {
    // Un párrafo gigante se parte a la fuerza para no pasar el límite.
    for (let i = 0; i < parrafo.length; i += maxCaracteres) {
      const trozo = parrafo.slice(i, i + maxCaracteres);
      if (actual.length + trozo.length + 2 > maxCaracteres) cerrar();
      actual += (actual ? '\n\n' : '') + trozo;
    }
  }
  cerrar();
  return salida;
}
