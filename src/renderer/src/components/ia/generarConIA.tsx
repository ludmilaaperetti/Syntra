import { useEffect, useRef, useState } from 'react';
import { CartelError } from '../comunes/cartelError';
import { PantallaPrevia } from './pantallaPrevia';
import {
  nombreProveedorIA,
  NOMBRE_TIPO_IA,
  type ProgresoIA,
  type PropuestaIA,
  type TipoMaterialIA,
} from '../../types/ia';
import '../../styles/ia.css';

interface GenerarConIAProps {
  archivo: { id: number; nombre: string; extension: string | null };
  onCerrar: () => void;
}

type Paso = 'elegir' | 'generando' | 'revisar' | 'listo';

const TIPOS: TipoMaterialIA[] = ['resumen', 'cuestionario', 'mapaMental'];

// Elegir qué generar → progreso "parte X de N" con Cancelar → pantalla previa → guardado.
export function GenerarConIA({ archivo, onCerrar }: GenerarConIAProps) {
  const [paso, setPaso] = useState<Paso>('elegir');
  const [tipo, setTipo] = useState<TipoMaterialIA>('resumen');
  const [progreso, setProgreso] = useState<ProgresoIA | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaIA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trabajoId = useRef<string | null>(null);

  useEffect(() => window.api.alProgresoIA((p) => {
    if (p.trabajoId === trabajoId.current) setProgreso(p);
  }), []);

  // Si se cierra el modal a mitad de camino, se cancela el pedido.
  useEffect(() => () => {
    if (trabajoId.current) void window.api.cancelarMaterialIA({ trabajoId: trabajoId.current }).catch(() => {});
  }, []);

  const generar = async () => {
    const id = crypto.randomUUID();
    trabajoId.current = id;
    setError(null);
    setProgreso(null);
    setPaso('generando');
    try {
      const r = await window.api.generarMaterialIA({ trabajoId: id, idArchivo: archivo.id, tipo });
      if (r.ok) {
        setPropuesta(r.propuesta);
        setPaso('revisar');
      } else {
        setPaso('elegir'); // canceló
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar.');
      setPaso('elegir');
    } finally {
      trabajoId.current = null;
    }
  };

  const cancelar = () => {
    if (trabajoId.current) void window.api.cancelarMaterialIA({ trabajoId: trabajoId.current });
  };

  const pct = progreso && progreso.total > 0 ? Math.round((progreso.parte / progreso.total) * 100) : 0;

  return (
    <div className="visor-overlay">
      <div className={`ia-modal ${paso === 'revisar' ? 'ia-modal--grande' : ''}`} role="dialog" aria-label="Generar con IA">
        <header className="visor__encabezado">
          <h3 className="visor__titulo">Generar con IA · {archivo.nombre}.{archivo.extension}</h3>
          {paso !== 'revisar' && (
            <button type="button" className="visor-boton visor-boton--contorno" onClick={onCerrar}>Cerrar</button>
          )}
        </header>

        {error && <CartelError mensaje={error} titulo="No se pudo generar" onCerrar={() => setError(null)} onReintentar={generar} />}

        {paso === 'elegir' && (
          <div className="ia-elegir">
            <p className="ia-elegir__texto">¿Qué querés que arme la IA con este archivo?</p>
            <div className="ia-elegir__opciones" role="radiogroup" aria-label="Tipo de material">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  className={`ia-elegir__opcion ${tipo === t ? 'ia-elegir__opcion--activa' : ''}`}
                  onClick={() => setTipo(t)}
                >
                  {NOMBRE_TIPO_IA[t]}
                </button>
              ))}
            </div>
            <button type="button" className="visor-boton" onClick={generar}>Generar</button>
          </div>
        )}

        {paso === 'generando' && (
          <div className="ia-progreso" aria-live="polite">
            <progress className="ia-progreso__barra" value={pct} max={100} />
            <p className="ia-progreso__texto">
              {!progreso || progreso.estado === 'en_cola'
                ? 'Esperando turno…'
                : progreso.total > 0
                  ? `Parte ${progreso.parte} de ${progreso.total}`
                  : progreso.mensaje ?? 'Preparando…'}
              {progreso?.proveedor && ` · ${nombreProveedorIA(progreso.proveedor)}`}
            </p>
            <button type="button" className="visor-boton visor-boton--contorno" onClick={cancelar}>Cancelar</button>
          </div>
        )}

        {paso === 'revisar' && propuesta && (
          <PantallaPrevia
            propuesta={propuesta}
            onGuardado={() => setPaso('listo')}
            onDescartado={onCerrar}
          />
        )}

        {paso === 'listo' && (
          <div className="ia-elegir">
            <p className="ia-elegir__texto">Listo, se guardó el {NOMBRE_TIPO_IA[propuesta!.tipo].toLowerCase()}.</p>
            <button type="button" className="visor-boton" onClick={onCerrar}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
