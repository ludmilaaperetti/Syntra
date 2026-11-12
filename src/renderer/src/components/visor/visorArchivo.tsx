import { useEffect, useRef, useState } from 'react';
import type { Archivo } from '../../types/nodo';
import { CartelError } from '../comunes/cartelError';
import { tipoVisor } from './formatos';
import { VisorPdf } from './visorPdf';
import { VisorDocx } from './visorDocx';
import { VisorExcel } from './visorExcel';
import { VisorTexto } from './visorTexto';
import { MenuAbrirCon } from './menuAbrirCon';
import '../../styles/visor.css';
import { extraerBloques } from '../../voz/extraerTexto';
import { anteriorTitulo, detenerLectura, empezarLectura, pausarLectura, seguirLectura, siguienteTitulo } from '../../voz/lectorDocumento';

interface VisorArchivoProps {
  archivo: Archivo;
  onCerrar: () => void;
  onGuardado: () => void;
  soloLectura?: boolean; // true: no se guarda nada aunque el visor permita editar
}

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto);

// Carga el archivo desde el main y elige el visor según la extensión.
export function VisorArchivo({ archivo, onCerrar, onGuardado, soloLectura = false }: VisorArchivoProps) {
  const [contenido, setContenido] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lectura, setLectura] = useState<'quieta' |'leyendo' | 'pausada'>('quieta');
  const [aviso, setAviso] = useState<string | null>(null);
  const tipo = tipoVisor(archivo.extension);

  useEffect(() => {
    window.api
      .leerArchivo({ id: archivo.id })
      .then((r) => setContenido(r.contenido))
      .catch((e) => setError(mensaje(e, 'No se pudo abrir el archivo.')));
  }, [archivo.id]);

  const guardarBytes = async (bytes: Uint8Array) => {
    if (soloLectura) return setError('Tu rol en este proyecto es de solo lectura.');
    try {
      await window.api.guardarArchivo({ id: archivo.id, contenido: bytes });
      setAviso('Cambios guardados.');
      onGuardado();
    } catch (e) {
      setError(mensaje(e, 'No se pudo guardar.'));
    }
  };

  const guardarDocx = async (html: string) => {
    if (soloLectura) return setError('Tu rol en este proyecto es de solo lectura.');
    try {
      await window.api.guardarDocx({ id: archivo.id, html });
      setAviso('Cambios guardados.');
      onGuardado();
    } catch (e) {
      setError(mensaje(e, 'No se pudo guardar.'));
    }
  };

  useEffect(() => () => detenerLectura(), []); // al cerrar el visor, se calla

  // Cuando el archivo termina de cargar, el foco va a "Leer en voz alta":
  // si no, queda atrás del visor y con Tab nunca se llega a sus botones.
  const botonLeer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (contenido) botonLeer.current?.focus();
  }, [contenido]);

  // Mientras lee, ← y → cambian de página sin cortar la lectura.
  useEffect(() => {
    if (lectura !== 'leyendo') return;
    const alTeclear = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable) return;
      if (e.key === 'ArrowRight') siguienteTitulo();
      else if (e.key === 'ArrowLeft') anteriorTitulo();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [lectura]);

  const alternarLectura = async () => {
    if (lectura === 'leyendo') {
      pausarLectura();
      setLectura('pausada');
    } else if (lectura === 'pausada') {
      seguirLectura();
      setLectura('leyendo');
    } else if (contenido) {
      setLectura('leyendo');
      empezarLectura(await extraerBloques(contenido, archivo.extension ?? ''));
    }
  };

  return (
    <div className="visor-overlay">
      <div className="visor">
        <header className="visor__encabezado">
          <h3 className="visor__titulo">{archivo.nombre}.{archivo.extension}</h3>
          <div className="visor__acciones">
                   <button ref={botonLeer} className="visor-boton visor-boton--contorno" onClick={alternarLectura} disabled={!contenido}>
              {lectura === 'leyendo' ? 'Pausar lectura' : lectura === 'pausada' ? 'Seguir leyendo' : 'Leer en voz alta'}
            </button>     
            <MenuAbrirCon archivo={archivo} onError={setError} />
            <button className="visor-boton visor-boton--contorno" onClick={onCerrar}>Cerrar</button>
          </div>
        </header>

        {soloLectura && <p className="visor__aviso">Solo lectura: tu rol no permite modificar este archivo.</p>}
        {error && <CartelError mensaje={error} onCerrar={() => setError(null)} />}
        {aviso && (
          <p className="visor__aviso" onClick={() => setAviso(null)}>{aviso}</p>
        )}

        <div className="visor__cuerpo">
          {!contenido && !error && <p className="visor__cargando">Cargando…</p>}
          {contenido && tipo === 'pdf' && <VisorPdf contenido={contenido} onGuardar={guardarBytes} soloLectura={soloLectura} />}
          {contenido && tipo === 'docx' && <VisorDocx contenido={contenido} onGuardar={guardarDocx} soloLectura={soloLectura} />}
          {contenido && tipo === 'xlsx' && <VisorExcel contenido={contenido} onGuardar={guardarBytes} soloLectura={soloLectura} />}
          {contenido && tipo === 'texto' && <VisorTexto contenido={contenido} onGuardar={guardarBytes} soloLectura={soloLectura} />}
        </div>
      </div>
    </div>
  );
}