import { useEffect, useState } from 'react';
import type { Deck, Flashcard } from '../../types/flashcards';

type Dificultad = 'dificil' | 'intermedio' | 'facil';

interface PanelFlashcardsProps {
  usuarioId: number;
  idDeck: number;
}

// Repaso del mazo de la sesión sin salir de ella: pregunta, respuesta y cómo te resultó.
// Cada respuesta se registra en la repetición espaciada, igual que en la pantalla de Flashcards.
export function PanelFlashcards({ usuarioId, idDeck }: PanelFlashcardsProps) {
  const [mazo, setMazo] = useState<Deck | null>(null);
  const [tarjetas, setTarjetas] = useState<Flashcard[]>([]);
  const [indice, setIndice] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCargando(true);
    Promise.all([window.api.listarDecks(usuarioId), window.api.listarFlashcards({ usuarioId, deckId: idDeck })])
      .then(([mazos, listado]) => {
        setMazo(mazos.find((m) => m.idDeck === idDeck) ?? null);
        setTarjetas(listado);
        setIndice(0);
        setVolteada(false);
      })
      .catch(() => setError('No se pudo cargar el mazo.'))
      .finally(() => setCargando(false));
  }, [usuarioId, idDeck]);

  async function evaluar(dificultad: Dificultad) {
    const actual = tarjetas[indice];
    if (!actual) return;
    setGuardando(true);
    setError('');
    try {
      await window.api.registrarRevision({ usuarioId, flashcardId: actual.idFlashcard, dificultad });
      setVolteada(false);
      setIndice((i) => i + 1);
    } catch {
      setError('No se pudo guardar el repaso.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="sesion__nota">Cargando mazo…</p>;
  if (!mazo) return <p className="sesion__nota">El mazo de esta sesión ya no existe.</p>;
  if (tarjetas.length === 0) return <p className="sesion__nota">"{mazo.nombre}" todavía no tiene tarjetas.</p>;

  const actual = tarjetas[indice];

  // Pasa a la siguiente sin registrar el repaso.
  function saltar() {
    setVolteada(false);
    setIndice((i) => i + 1);
  }

  if (!actual) {
    return (
      <div className="flash-sesion flash-sesion--fin">
        <p className="flash-sesion__fin">¡Terminaste el mazo "{mazo.nombre}"!</p>
        <button type="button" className="flash-sesion__accion" onClick={() => setIndice(0)}>
          Repasar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="flash-sesion">
      <p className="flash-sesion__mazo">
        {mazo.nombre} · {indice + 1} de {tarjetas.length}
      </p>
      <span className="flash-sesion__barra" aria-hidden="true">
        <span style={{ width: `${(indice / tarjetas.length) * 100}%` }} />
      </span>

      <div className="flash-sesion__tarjeta" aria-live="polite">
        <small>{volteada ? 'Respuesta' : 'Pregunta'}</small>
        <p>{volteada ? actual.respuesta : actual.pregunta}</p>
      </div>

      {error && <p className="flash-sesion__error">{error}</p>}

      {volteada ? (
        <div className="flash-sesion__dificultades" role="group" aria-label="¿Cómo te resultó?">
          <button type="button" disabled={guardando} onClick={() => void evaluar('dificil')}>Difícil</button>
          <button type="button" disabled={guardando} onClick={() => void evaluar('intermedio')}>Intermedio</button>
          <button type="button" disabled={guardando} onClick={() => void evaluar('facil')}>Fácil</button>
        </div>
      ) : (
        <button type="button" className="flash-sesion__accion" onClick={() => setVolteada(true)}>
          Mostrar respuesta
        </button>
      )}
      <button type="button" className="flash-sesion__saltar" disabled={guardando} onClick={saltar}>
        Saltar
      </button>
    </div>
  );
}