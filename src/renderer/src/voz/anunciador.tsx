import { useEffect, useState } from 'react';
import { configurarLector, escucharAnuncios } from './narrador';

export function Anunciador() {
  const [texto, setTexto] = useState('');

  useEffect(() => window.api.alCambiarLector(configurarLector), []);

  useEffect(
    () =>
      escucharAnuncios((nuevo) => {
        setTexto('');
        requestAnimationFrame(() => setTexto(nuevo));
      }),
    []
  );

  return (
    <div role="status" aria-live="polite" className="soloLectores">
      {texto}
    </div>
  );
}