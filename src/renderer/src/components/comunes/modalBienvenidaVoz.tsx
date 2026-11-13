import { useEffect, useRef } from 'react';
import { useVoice } from '../../hooks/useVoice';
import '../../styles/voz.css';

export function ModalBienvenidaVoz() {
  const { modoVoz, responderModoVoz } = useVoice();
  const dialogoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogoRef.current?.focus();
  }, []);

  useEffect(() => {
    if (modoVoz !== null) return;

    const alPresionar = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        dialogoRef.current?.focus();
      } else if (event.code === 'Space') {
        event.preventDefault();
        responderModoVoz(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        responderModoVoz(false);
      }
    };

    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [modoVoz, responderModoVoz]);

  if (modoVoz !== null) return null;

  return (
    <div className="voz-modal-fondo">
      <div
        ref={dialogoRef}
        className="voz-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voz-modal-titulo"
        tabIndex={-1}
      >
        <h1 id="voz-modal-titulo">¿Querés usar Syntra con la voz?</h1>
        <p>Apretá Espacio o decí sí.</p>
        <p>Escape para no.</p>
      </div>
    </div>
  );
}
