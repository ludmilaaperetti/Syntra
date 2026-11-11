import { test, expect } from 'vitest';
import { combinarCuestionario, combinarFlashcards, combinarResumenes } from '../../logicaNoPersistente/ia/postproceso.js';

const material = 'La mitocondria produce energía en la célula. El núcleo guarda el ADN de la célula.';

test('flashcards: une fragmentos, quita duplicados y fuentes inventadas', () => {
  const t = (frente: string, fuente: string) => ({ frente, dorso: 'respuesta', fuente });
  const r = combinarFlashcards(
    [
      { tarjetas: [t('Qué produce la mitocondria', 'La mitocondria produce energía'), t('Inventada', 'esto no está en el texto')] },
      { tarjetas: [t('Qué produce la mitocondria', 'La mitocondria produce energía'), t('Dónde está el ADN', 'El núcleo guarda el ADN')] },
    ],
    material,
  );
  expect(r.tarjetas.map((x) => x.frente)).toEqual(['Qué produce la mitocondria', 'Dónde está el ADN']);
});

test('flashcards: si ninguna tiene fuente real, falla con un error claro', () => {
  const malas = { tarjetas: [{ frente: 'Algo', dorso: 'x', fuente: 'texto inexistente en material' }] };
  expect(() => combinarFlashcards([malas], material)).toThrow(/fuente verificable/);
});

test('cuestionario: descarta opciones repetidas y fuentes inventadas', () => {
  const q = (enunciado: string, opciones: string[], fuente: string) => ({ enunciado, opciones, correcta: 0, explicacion: 'porque sí', fuente });
  const r = combinarCuestionario(
    [
      {
        preguntas: [
          q('¿Qué produce la mitocondria?', ['Energía', 'ADN', 'Agua', 'Luz'], 'La mitocondria produce energía'),
          q('¿Pregunta con opciones repetidas?', ['A', 'A', 'B', 'C'], 'La mitocondria produce energía'),
          q('¿Pregunta inventada?', ['A', 'B', 'C', 'D'], 'frase que no existe en el material'),
        ],
      },
    ],
    material,
  );
  expect(r.preguntas.length).toBe(1);
  expect(r.preguntas[0]?.enunciado).toBe('¿Qué produce la mitocondria?');
});

test('resumen: une puntos sin repetir y respeta el máximo', () => {
  const r = combinarResumenes([
    { titulo: 'Titulo A', puntos: ['uno', 'dos'], resumen: 'Primera parte del resumen.' },
    { titulo: 'Titulo B', puntos: ['dos', 'tres'], resumen: 'Segunda parte del resumen.' },
  ]);
  expect(r.titulo).toBe('Titulo A');
  expect(r.puntos).toEqual(['uno', 'dos', 'tres']);
  expect(r.resumen).toContain('Segunda parte');
  expect(() => combinarResumenes([])).toThrow();
});
