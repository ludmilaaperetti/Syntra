import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CartelAviso, type TipoAviso } from '../components/comunes/cartelAviso';
import '../styles/avisos.css';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensaje: string;
}

interface OpcionesConfirmacion {
  titulo?: string;
  textoConfirmar?: string;
  peligro?: boolean;
}

interface ConfirmacionPendiente extends Required<OpcionesConfirmacion> {
  id: number;
  mensaje: string;
  resolver: (confirmado: boolean) => void;
}

interface AvisosContexto {
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
  confirmar: (mensaje: string, opciones?: OpcionesConfirmacion) => Promise<boolean>;
}

const DURACION_MS: Record<TipoAviso, number> = { exito: 3500, info: 3500, error: 6000 };
const MAXIMO_VISIBLES = 3;

const Contexto = createContext<AvisosContexto | null>(null);

// Carteles de confirmación de toda la app ("Se creó correctamente la sesión", "Se guardaron los cambios"...).
// Van en una esquina, se apilan y se cierran solos. Viven arriba de las rutas, así un cartel
// sigue visible aunque se cambie de pantalla (por ejemplo, al crear una sesión y entrar a ella).
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);
  const siguienteId = useRef(1);
  const confirmacionActual = useRef<ConfirmacionPendiente | null>(null);
  const confirmacionesPendientes = useRef<ConfirmacionPendiente[]>([]);

  const cerrar = useCallback((id: number) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  const confirmar = useCallback((mensaje: string, opciones: OpcionesConfirmacion = {}) => new Promise<boolean>((resolver) => {
    const nueva: ConfirmacionPendiente = {
      id: siguienteId.current++,
      mensaje,
      titulo: opciones.titulo ?? 'Confirmar acción',
      textoConfirmar: opciones.textoConfirmar ?? 'Confirmar',
      peligro: opciones.peligro ?? false,
      resolver,
    };

    if (confirmacionActual.current) {
      confirmacionesPendientes.current.push(nueva);
      return;
    }

    confirmacionActual.current = nueva;
    setConfirmacion(nueva);
  }), []);

  const resolverConfirmacion = useCallback((confirmado: boolean) => {
    const actual = confirmacionActual.current;
    if (!actual) return;

    const siguiente = confirmacionesPendientes.current.shift() ?? null;
    confirmacionActual.current = siguiente;
    setConfirmacion(siguiente);
    actual.resolver(confirmado);
  }, []);

  useEffect(() => {
    if (!confirmacion) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      resolverConfirmacion(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [confirmacion, resolverConfirmacion]);

  const mostrar = useCallback(
    (tipo: TipoAviso, mensaje: string) => {
      const id = siguienteId.current++;
      setAvisos((actuales) => [...actuales.slice(-(MAXIMO_VISIBLES - 1)), { id, tipo, mensaje }]);
      window.setTimeout(() => cerrar(id), DURACION_MS[tipo]);
    },
    [cerrar]
  );

  const valor = useMemo<AvisosContexto>(
    () => ({
      exito: (m) => mostrar('exito', m),
      error: (m) => mostrar('error', m),
      info: (m) => mostrar('info', m),
      confirmar,
    }),
    [confirmar, mostrar]
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="avisos" role="region" aria-label="Notificaciones" aria-live="polite">
        {avisos.map((a) => (
          <CartelAviso key={a.id} tipo={a.tipo} mensaje={a.mensaje} onCerrar={() => cerrar(a.id)} />
        ))}
      </div>
      {confirmacion && (
        <div className="confirmacion__overlay" onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) resolverConfirmacion(false);
        }}>
          <section
            className="confirmacion__dialogo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`confirmacion-titulo-${confirmacion.id}`}
            aria-describedby={`confirmacion-mensaje-${confirmacion.id}`}
          >
            <h2 className="confirmacion__titulo" id={`confirmacion-titulo-${confirmacion.id}`}>{confirmacion.titulo}</h2>
            <p className="confirmacion__mensaje" id={`confirmacion-mensaje-${confirmacion.id}`}>{confirmacion.mensaje}</p>
            <div className="confirmacion__acciones">
              <button type="button" className="app-boton app-boton--contorno" onClick={() => resolverConfirmacion(false)}>
                Cancelar
              </button>
              <button
                type="button"
                autoFocus
                className={`app-boton app-boton--primario${confirmacion.peligro ? ' confirmacion__boton--peligro' : ''}`}
                onClick={() => resolverConfirmacion(true)}
              >
                {confirmacion.textoConfirmar}
              </button>
            </div>
          </section>
        </div>
      )}
    </Contexto.Provider>
  );
}

const SIN_PROVEEDOR: AvisosContexto = {
  exito: () => undefined,
  error: () => undefined,
  info: () => undefined,
  confirmar: async () => false,
};

// Devuelve las funciones para mostrar carteles (el objeto es estable entre renders).
// Fuera del proveedor no hace nada, así no rompe pantallas sueltas.
export function usarAvisos(): AvisosContexto {
  return useContext(Contexto) ?? SIN_PROVEEDOR;
}
