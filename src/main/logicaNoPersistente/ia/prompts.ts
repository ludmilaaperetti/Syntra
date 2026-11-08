import type { TipoMaterialIA } from './tipos';

export const SISTEMA_IA =
  'Sos un asistente de estudio. Trabajás SOLO con el texto que te dan, sin inventar datos. '
  + 'Respondés en español y SIEMPRE con JSON válido que cumpla el esquema indicado.';

const INSTRUCCIONES: Record<TipoMaterialIA, string> = {
  resumen:
    'Hacé un resumen de estudio del fragmento: un título, entre 3 y 10 ideas clave (una oración cada una) '
    + 'y secciones por tema con explicaciones claras.',
  cuestionario:
    'Armá entre 4 y 8 preguntas de opción múltiple sobre el fragmento. Cada una con 4 opciones, '
    + 'una sola correcta (indiceCorrecta empieza en 0), distractores creíbles y una explicación breve.',
  mapaMental:
    'Armá un mapa mental del fragmento como lista plana de nodos. Exactamente un nodo con padreId null '
    + '(el tema central); el resto con padreId apuntando a un id existente. Textos cortos (máximo 6 palabras). '
    + 'Ids cortos como "n1", "n2". Entre 8 y 25 nodos, hasta 3 niveles.',
};

export function armarPrompt(
  tipo: TipoMaterialIA,
  fragmento: { texto: string; titulo?: string },
  parte: number,
  total: number,
): string {
  const contexto = total > 1 ? `Este es el fragmento ${parte} de ${total} de un documento más largo.\n` : '';
  const seccion = fragmento.titulo ? `Sección: ${fragmento.titulo}\n` : '';
  return `${INSTRUCCIONES[tipo]}\n\n${contexto}${seccion}<texto>\n${fragmento.texto}\n</texto>`;
}
