import { confirmar } from './confirmacion';
import { configurarLector, hablar, hayLector, usarVozPropia } from './narrador';

const INDICACIONES =
  'Bienvenida a Syntra. Podés ir a Material, Flashcards, Sesiones, Calendario, Horarios, Métodos y Notificaciones. Con Tab recorrés la pantalla.';

let yaSaludo = false;

// La elección se guarda por usuario: la pregunta se hace una sola vez.
const clave = () => `syntra:vozPropia:${localStorage.getItem('usuarioId')}`;

function leerEleccion(): boolean | null {
  try {
    const valor = localStorage.getItem(clave());
    return valor === null ? null : valor === 'si';
  } catch {
    return null;
  }
}

function guardarEleccion(si: boolean): void {
  try {
    localStorage.setItem(clave(), si ? 'si' : 'no');
  } catch {
    // Sin almacenamiento: se vuelve a preguntar la próxima vez.
  }
}

// Al volver al inicio de sesión: el próximo usuario arranca de cero.
export function reiniciarBienvenida(): void {
  yaSaludo = false;
  usarVozPropia(false);
}

// La primera vez que se llega al inicio: si hay NVDA, ofrece dormirlo para que guíe la voz de Syntra.
export async function darBienvenida(): Promise<void> {
  if (yaSaludo) return hablar('Inicio');
  yaSaludo = true;

  // Se vuelve a preguntar: si Windows avisó tarde de NVDA, Syntra hablaría encima.
  configurarLector(await window.api.lectorPantallaActivo().catch(() => hayLector()));

  if (hayLector()) {
    let vozPropia = leerEleccion();
    if (vozPropia === null) {
      vozPropia = await confirmar(
        'Para que te guíe la voz de Syntra, activá el modo silencioso de NVDA con Insert más Shift más S y confirmá.'
      );
      guardarEleccion(vozPropia);
    }
    usarVozPropia(vozPropia);
  }
  hablar(INDICACIONES);
}
