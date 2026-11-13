import { confirmar } from './confirmacion';
import { activarModoVoz, configurarLector, hablar, hayLector, usarVozPropia } from './narrador';

const INDICACIONES =
  'Bienvenida a Syntra. Podés ir a Material, Flashcards, Sesiones, Calendario, Horarios, Métodos y Notificaciones. Con Tab recorrés la pantalla.';

let yaSaludo = false;

// Las elecciones se guardan por usuario: cada pregunta se hace una sola vez.
const claveModoVoz = () => `syntra:modoVoz:${localStorage.getItem('usuarioId')}`;
const claveVozPropia = () => `syntra:vozPropia:${localStorage.getItem('usuarioId')}`;

function leerEleccion(clave: string): boolean | null {
  try {
    const valor = localStorage.getItem(clave);
    return valor === null ? null : valor === 'si';
  } catch {
    return null;
  }
}

function guardarEleccion(clave: string, si: boolean): void {
  try {
    localStorage.setItem(clave, si ? 'si' : 'no');
  } catch {
    // Sin almacenamiento: se vuelve a preguntar la próxima vez.
  }
}

// Al volver al inicio de sesión: el próximo usuario arranca de cero.
export function reiniciarBienvenida(): void {
  yaSaludo = false;
  usarVozPropia(false);
  activarModoVoz(true);
}

// La primera vez que se llega al inicio: si hay NVDA, ofrece dormirlo para que guíe la voz de Syntra.
export async function darBienvenida(): Promise<void> {
  if (yaSaludo) return hablar('Inicio');
  yaSaludo = true;

  // Se vuelve a preguntar: si Windows avisó tarde de NVDA, Syntra hablaría encima.
  configurarLector(await window.api.lectorPantallaActivo().catch(() => hayLector()));

  // Primero: si este usuario quiere usar Syntra con voz. Si dice que no, Syntra no habla más.
  let modoVoz = leerEleccion(claveModoVoz());
  if (modoVoz === null) {
    modoVoz = await confirmar('¿Querés que Syntra te guíe con su voz?');
    guardarEleccion(claveModoVoz(), modoVoz);
  }
  activarModoVoz(modoVoz);
  if (!modoVoz) return;

  if (hayLector()) {
    let vozPropia = leerEleccion(claveVozPropia());
    if (vozPropia === null) {
      vozPropia = await confirmar(
        'Para que te guíe la voz de Syntra, activá el modo silencioso de NVDA con Insert más Shift más S y confirmá.'
      );
      guardarEleccion(claveVozPropia(), vozPropia);
    }
    usarVozPropia(vozPropia);
  }
  hablar(INDICACIONES);
}
