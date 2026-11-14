import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, MessageCircle, PanelLeft, PanelLeftClose, Pencil, SendHorizontal, Sparkles, Square, Trash2, X } from 'lucide-react';
import { PlantillaLayout } from '../plantillaLayout/plantillaLayout';
import { CartelError } from '../../components/comunes/cartelError';
import { TextoConFormulas } from '../../components/comunes/textoConFormulas';
import { usarAvisos } from '../../hooks/usarAvisos';
import { nombreProveedorIA } from '../../types/ia';
import type { ConversacionIA, MensajeIA } from '../../types/chatIA';
import { mensajeError } from '../metodos/utilidadesMetodosIA';
import '../../styles/chatIA.css';

const SUGERENCIAS = [
  'Explicame un tema con un ejemplo sencillo',
  'Armame un plan para estudiar para un parcial en una semana',
  'Haceme preguntas para practicar un tema',
  'Dame técnicas para concentrarme mejor al estudiar',
];

// Pregunta que todavía espera respuesta: se muestra enseguida, pero se guarda recién cuando la IA responde.
interface Pendiente {
  trabajoId: string;
  texto: string;
}

function formatearDia(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

// Chat con IA: se pregunta lo que sea y responde la IA disponible (Luna → Gemini → Gemma sin internet).
// Las conversaciones quedan guardadas: se ven con el botón del panel (arriba a la izquierda).
// Los brillitos empiezan en el centro; cuando se empieza a escribir pasan al lado de ese botón
// y sirven para empezar una conversación nueva.
export function ChatIAPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const idConversacion = id ? Number(id) : null;
  const { confirmar } = usarAvisos();

  const [conversaciones, setConversaciones] = useState<ConversacionIA[]>([]);
  const [mensajes, setMensajes] = useState<MensajeIA[]>([]);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState('');
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [error, setError] = useState('');
  const [renombrando, setRenombrando] = useState<{ id: number; titulo: string } | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  const montado = useRef(true);
  // Al crear una conversación ya tenemos sus mensajes: no hace falta volver a pedirlos al cambiar la ruta.
  const recienCreada = useRef<number | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const cargarLista = useCallback(async () => {
    try {
      setConversaciones(await window.api.listarConversacionesIA());
    } catch (e) {
      setError(mensajeError(e, 'No se pudieron cargar tus conversaciones.'));
    }
  }, []);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  // Abrir la conversación de la ruta (o una vacía en /chat).
  useEffect(() => {
    if (idConversacion == null) {
      setMensajes([]);
      return;
    }
    if (recienCreada.current === idConversacion) {
      recienCreada.current = null;
      return;
    }
    let vigente = true;
    setCargando(true);
    setError('');
    window.api
      .obtenerConversacionIA({ idConversacion })
      .then((r) => vigente && setMensajes(r.mensajes))
      .catch((e) => {
        if (!vigente) return;
        setMensajes([]);
        setError(mensajeError(e, 'No se pudo abrir la conversación.'));
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [idConversacion]);

  // El historial se cierra con Escape (si no se está renombrando una conversación).
  useEffect(() => {
    if (!historialAbierto) return;
    const alPresionar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !renombrando) setHistorialAbierto(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [historialAbierto, renombrando]);

  // Siempre se ve el último mensaje.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, pendiente]);

  // Al abrir otra conversación, el cuadro de texto queda listo para escribir.
  useEffect(() => {
    entradaRef.current?.focus();
  }, [idConversacion]);

  // El cuadro crece con el texto (hasta un máximo; después aparece la barra).
  useEffect(() => {
    const el = entradaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [texto]);

  async function enviar(contenido = texto) {
    const pregunta = contenido.trim();
    if (!pregunta || pendiente) return;
    const trabajo: Pendiente = { trabajoId: crypto.randomUUID(), texto: pregunta };
    setPendiente(trabajo);
    setTexto('');
    setError('');

    try {
      const r = await window.api.enviarMensajeChat({ trabajoId: trabajo.trabajoId, idConversacion, texto: pregunta });
      if (!montado.current) return;
      if (!r.ok) {
        setTexto(pregunta); // canceló: la pregunta vuelve al cuadro para editarla o reenviarla
        return;
      }
      setMensajes((actuales) => [...actuales, ...r.mensajes]);
      setConversaciones((lista) => [r.conversacion, ...lista.filter((c) => c.idConversacion !== r.conversacion.idConversacion)]);
      if (idConversacion == null) {
        recienCreada.current = r.conversacion.idConversacion;
        navigate(`/chat/${r.conversacion.idConversacion}`, { replace: true });
      }
    } catch (e) {
      if (!montado.current) return;
      setTexto(pregunta);
      setError(mensajeError(e, 'La IA no pudo responder. Probá de nuevo en un rato.'));
    } finally {
      if (montado.current) setPendiente(null);
    }
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar();
  }

  // Enter envía; Shift+Enter hace un salto de línea.
  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      void enviar();
    }
  }

  function cancelar() {
    if (pendiente) void window.api.cancelar(pendiente.trabajoId);
  }

  async function guardarTitulo() {
    if (!renombrando) return;
    const titulo = renombrando.titulo.trim();
    const actual = conversaciones.find((c) => c.idConversacion === renombrando.id);
    setRenombrando(null);
    if (!titulo || titulo === actual?.titulo) return;
    try {
      const cambiada = await window.api.renombrarConversacionIA({ idConversacion: renombrando.id, titulo });
      setConversaciones((lista) => lista.map((c) => (c.idConversacion === cambiada.idConversacion ? cambiada : c)));
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar el título.'));
    }
  }

  async function eliminar(conversacion: ConversacionIA) {
    const ok = await confirmar(`¿Eliminar "${conversacion.titulo}"? Se borran todos sus mensajes.`, {
      titulo: 'Eliminar conversación',
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await window.api.eliminarConversacionIA({ idConversacion: conversacion.idConversacion });
      setConversaciones((lista) => lista.filter((c) => c.idConversacion !== conversacion.idConversacion));
      if (conversacion.idConversacion === idConversacion) navigate('/chat');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo eliminar la conversación.'));
    }
  }

  async function copiar(mensaje: MensajeIA) {
    try {
      await navigator.clipboard.writeText(mensaje.texto);
      setCopiado(mensaje.idMensaje);
      setTimeout(() => montado.current && setCopiado(null), 1500);
    } catch {
      setError('No se pudo copiar la respuesta.');
    }
  }

  function nuevaConversacion() {
    setTexto('');
    setError('');
    setHistorialAbierto(false);
    if (idConversacion != null) navigate('/chat');
    else entradaRef.current?.focus();
  }

  function abrirConversacion(id: number) {
    setHistorialAbierto(false);
    navigate(`/chat/${id}`);
  }

  const ocupado = pendiente !== null;
  const vacia = !cargando && mensajes.length === 0 && !pendiente;
  // Los brillitos pasan del centro a la barra de arriba en cuanto se empieza a escribir.
  const iniciada = !vacia || texto.trim().length > 0;

  return (
    <PlantillaLayout titulo="IA" idActivo="chat" usuario={{ nombre: 'Usuario' }}>
      <div className="chat-ia">
        <div className="chat-ia__barra">
          <button
            type="button"
            className="chat-ia__icono-boton"
            onClick={() => setHistorialAbierto((v) => !v)}
            title={historialAbierto ? 'Ocultar conversaciones' : 'Ver conversaciones anteriores'}
            aria-label={historialAbierto ? 'Ocultar conversaciones' : 'Ver conversaciones anteriores'}
            aria-expanded={historialAbierto}
            aria-controls="chat-ia-historial"
          >
            {historialAbierto ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
          {iniciada && (
            <button
              type="button"
              className="chat-ia__icono-boton chat-ia__brillitos-barra"
              onClick={nuevaConversacion}
              disabled={ocupado}
              title="Nueva conversación"
              aria-label="Nueva conversación"
            >
              <Sparkles size={19} />
            </button>
          )}
        </div>

        {historialAbierto && (
          <>
            <div className="chat-ia__fondo" onClick={() => setHistorialAbierto(false)} />
            <aside id="chat-ia-historial" className="chat-ia__historial" aria-label="Conversaciones anteriores">
              <header className="chat-ia__historial-cabecera">
                <h2>Conversaciones</h2>
                <button
                  type="button"
                  className="chat-ia__icono-boton"
                  onClick={() => setHistorialAbierto(false)}
                  title="Cerrar"
                  aria-label="Cerrar conversaciones"
                >
                  <X size={18} />
                </button>
              </header>
              {conversaciones.length ? (
                <ul className="chat-ia__lista">
                  {conversaciones.map((c) => {
                    const activa = c.idConversacion === idConversacion;
                    if (renombrando?.id === c.idConversacion) {
                      return (
                        <li key={c.idConversacion} className="chat-ia__item chat-ia__item--activa">
                          <input
                            className="chat-ia__renombrar"
                            value={renombrando.titulo}
                            maxLength={120}
                            autoFocus
                            aria-label="Título de la conversación"
                            onChange={(e) => setRenombrando({ id: c.idConversacion, titulo: e.target.value })}
                            onBlur={() => void guardarTitulo()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void guardarTitulo();
                              if (e.key === 'Escape') setRenombrando(null);
                            }}
                          />
                        </li>
                      );
                    }
                    return (
                      <li key={c.idConversacion} className={`chat-ia__item${activa ? ' chat-ia__item--activa' : ''}`}>
                        <button
                          type="button"
                          className="chat-ia__abrir"
                          onClick={() => abrirConversacion(c.idConversacion)}
                          disabled={ocupado && !activa}
                          aria-current={activa ? 'page' : undefined}
                        >
                          <span className="chat-ia__titulo">{c.titulo}</span>
                          <small>{formatearDia(c.fechaActualizacion)}</small>
                        </button>
                        <span className="chat-ia__item-acciones">
                          <button
                            type="button"
                            title="Cambiar título"
                            aria-label={`Cambiar título de ${c.titulo}`}
                            onClick={() => setRenombrando({ id: c.idConversacion, titulo: c.titulo })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title="Eliminar"
                            aria-label={`Eliminar ${c.titulo}`}
                            onClick={() => void eliminar(c)}
                            disabled={ocupado && activa}
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="chat-ia__sin-conversaciones">Tus conversaciones van a aparecer acá.</p>
              )}
            </aside>
          </>
        )}

        <section className="chat-ia__principal">
          {error && <CartelError mensaje={error} onCerrar={() => setError('')} />}

          <div className="chat-ia__mensajes" aria-live="polite">
            {cargando && <p className="chat-ia__estado" role="status">Cargando conversación…</p>}

            {vacia && (
              <div className="chat-ia__bienvenida">
                {!iniciada && <span className="chat-ia__bienvenida-icono"><Sparkles size={26} /></span>}
                <h2>¿Por dónde empezamos?</h2>
                <p>Preguntá lo que quieras: dudas de un tema, ejercicios, cómo organizarte para estudiar…</p>
                <div className="chat-ia__sugerencias">
                  {SUGERENCIAS.map((s) => (
                    <button key={s} type="button" onClick={() => { setTexto(s); entradaRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m) =>
              m.rol === 'usuario' ? (
                <div key={m.idMensaje} className="chat-ia__burbuja chat-ia__burbuja--usuario">{m.texto}</div>
              ) : (
                <div key={m.idMensaje} className="chat-ia__respuesta">
                  <TextoConFormulas className="chat-ia__texto" texto={m.texto} />
                  <div className="chat-ia__respuesta-pie">
                    <button type="button" onClick={() => void copiar(m)} title="Copiar respuesta">
                      {copiado === m.idMensaje ? <Check size={14} /> : <Copy size={14} />}
                      {copiado === m.idMensaje ? 'Copiado' : 'Copiar'}
                    </button>
                    {m.proveedor && <small>Respondió {nombreProveedorIA(m.proveedor)}</small>}
                  </div>
                </div>
              ),
            )}

            {pendiente && (
              <>
                <div className="chat-ia__burbuja chat-ia__burbuja--usuario">{pendiente.texto}</div>
                <div className="chat-ia__respuesta chat-ia__respuesta--pensando" role="status">
                  <span className="chat-ia__puntos" aria-hidden="true"><i /><i /><i /></span>
                  Pensando…
                </div>
              </>
            )}
            <div ref={finRef} />
          </div>

          <form className="chat-ia__entrada" onSubmit={alEnviar}>
            <textarea
              ref={entradaRef}
              value={texto}
              rows={1}
              maxLength={8000}
              placeholder="Escribí tu pregunta…"
              aria-label="Mensaje para la IA"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alTeclear}
              disabled={cargando}
            />
            {ocupado ? (
              <button type="button" className="chat-ia__boton chat-ia__boton--cancelar" onClick={cancelar} title="Detener respuesta" aria-label="Detener respuesta">
                <Square size={16} />
              </button>
            ) : (
              <button type="submit" className="chat-ia__boton" disabled={!texto.trim() || cargando} title="Enviar" aria-label="Enviar">
                <SendHorizontal size={18} />
              </button>
            )}
          </form>
          <p className="chat-ia__ayuda">
            <MessageCircle size={13} /> Enter para enviar · Shift + Enter para un salto de línea. La IA puede equivocarse: revisá lo importante.
          </p>
        </section>
      </div>
    </PlantillaLayout>
  );
}
