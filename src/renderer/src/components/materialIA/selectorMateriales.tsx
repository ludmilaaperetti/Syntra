// src/renderer/src/components/materialIA/selectorMateriales.tsx
// Lista de archivos de Material con casillas para elegir uno o varios, y un buscador.
// Los estilos van en línea a propósito: el CSS global de los modales estira todos los <input> al 100% de ancho
// y rompía las casillas, así que acá se fija el tamaño de cada una.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ArchivoMaterial } from '../../utils/apiMaterialIA';
import styles from '../../styles/flashcards.module.css';

interface Props {
  archivos: ArchivoMaterial[];
  seleccionados: number[];
  onCambiar: (ids: number[]) => void;
  cargando?: boolean;
  deshabilitado?: boolean;
}

const casilla: CSSProperties = { width: 18, height: 18, minWidth: 18, padding: 0, margin: 0, flex: 'none', cursor: 'pointer' };
const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, margin: 0, padding: '6px 4px', fontWeight: 400, textAlign: 'left', cursor: 'pointer' };

export function SelectorMateriales({ archivos, seleccionados, onCambiar, cargando = false, deshabilitado = false }: Props) {
  const [filtro, setFiltro] = useState('');

  const visibles = useMemo(() => {
    const f = filtro.trim().toLocaleLowerCase();
    return f ? archivos.filter((a) => a.nombre.toLocaleLowerCase().includes(f)) : archivos;
  }, [archivos, filtro]);

  const idsVisibles = visibles.map((a) => a.id);
  const todos = idsVisibles.length > 0 && idsVisibles.every((id) => seleccionados.includes(id));

  const alternar = (id: number) =>
    onCambiar(seleccionados.includes(id) ? seleccionados.filter((x) => x !== id) : [...seleccionados, id]);

  const alternarTodos = () =>
    onCambiar(todos
      ? seleccionados.filter((id) => !idsVisibles.includes(id))
      : [...new Set([...seleccionados, ...idsVisibles])]);

  if (cargando) return <p className={styles.notice} role="status">Cargando tu material…</p>;
  if (archivos.length === 0) {
    return <p className={styles.notice}>No hay archivos con texto en Material (pdf, docx, txt o md). Subí alguno y volvé a intentar.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input
        type="search"
        placeholder="Buscar en tu material"
        aria-label="Buscar en tu material"
        value={filtro}
        disabled={deshabilitado}
        onChange={(e) => setFiltro(e.target.value)}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <label style={fila}>
          <input type="checkbox" style={casilla} checked={todos} disabled={deshabilitado || idsVisibles.length === 0} onChange={alternarTodos} />
          <span>Seleccionar todos</span>
        </label>
        <span style={{ fontSize: '0.9em', opacity: 0.75 }}>
          {seleccionados.length} {seleccionados.length === 1 ? 'elegido' : 'elegidos'}
        </span>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 2 }}>
        {visibles.length === 0 && <p className={styles.notice}>No hay archivos con ese nombre.</p>}
        {visibles.map((a) => (
          <label key={a.id} style={fila}>
            <input type="checkbox" style={casilla} checked={seleccionados.includes(a.id)} disabled={deshabilitado} onChange={() => alternar(a.id)} />
            <span style={{ display: 'grid', textAlign: 'left' }}>
              <strong style={{ fontWeight: 600 }}>{a.nombre}{a.extension ? `.${a.extension}` : ''}</strong>
              {a.carpeta && <small style={{ opacity: 0.7 }}>{a.carpeta}</small>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}