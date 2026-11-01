type Oyente = (texto: string) => void;

const CLAVE_VELOCIDAD = 'pref:vozVelocidad';
const oyentes = new Set<Oyente>();

let velocidad = leerVelocidad();
let lectorActivo = false; // NUEVO: true si NVDA, JAWS o el Narrador están prendidos

function leerVelocidad(): number {
  try {
    const guardada = Number(localStorage.getItem(CLAVE_VELOCIDAD));
    return guardada >= 0.5 && guardada <= 2 ? guardada : 1;
  } catch {
    return 1;
  }
}

function vozEnEspanol(): SpeechSynthesisVoice | undefined {
  const voces = speechSynthesis.getVoices();
  return voces.find((v) => v.lang === 'es-AR') ?? voces.find((v) => v.lang.startsWith('es'));
}

// NUEVO: el Anunciador llama a esto cuando main avisa si hay lector de pantalla.
export function configurarLector(activo: boolean): void {
  lectorActivo = activo;
}

export function hayLector(): boolean {
  return lectorActivo;
}

let pendiente: ReturnType<typeof setTimeout> | undefined;
let turno = 0;

// Dice un texto en voz alta y lo manda a la región aria-live.
// Corta lo que se estaba diciendo. alTerminar se llama solo si nadie la interrumpió.
export function hablar(texto: string, alTerminar?: () => void): void {
  const miTurno = ++turno;
  clearTimeout(pendiente);
  speechSynthesis.cancel();

  if (!lectorActivo) {
    // Chromium a veces descarta una frase que se pide justo después de cancel()
    // o se queda trabado "hablando": se espera un instante y se lo destraba con resume().
    pendiente = setTimeout(() => {
      const frase = new SpeechSynthesisUtterance(texto);
      frase.lang = 'es-AR';
      frase.rate = velocidad;
      const voz = vozEnEspanol();
      if (voz) frase.voice = voz;
      if (alTerminar) frase.onend = () => miTurno === turno && alTerminar();
      speechSynthesis.resume();
      speechSynthesis.speak(frase);
    }, 50);
  }

  oyentes.forEach((oyente) => oyente(texto));
}

export function detener(): void {
  turno++;
  clearTimeout(pendiente);
  speechSynthesis.cancel();
}

export function estaHablando(): boolean {
  return speechSynthesis.speaking;
}

export function cambiarVelocidad(nueva: number): void {
  velocidad = Math.min(2, Math.max(0.5, nueva));
  try {
    localStorage.setItem(CLAVE_VELOCIDAD, String(velocidad));
  } catch {
    // Sin almacenamiento: la velocidad dura hasta cerrar la app.
  }
}

export function obtenerVelocidad(): number {
  return velocidad;
}

// Devuelve la función para dejar de escuchar (sirve directo como cleanup de useEffect).
export function escucharAnuncios(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}