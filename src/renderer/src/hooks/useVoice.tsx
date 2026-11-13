import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { hablar } from '../utils/hablar';

type ModoVoz = boolean | null;

interface VoiceContexto {
  modoVoz: ModoVoz;
  setModoVoz: Dispatch<SetStateAction<ModoVoz>>;
  responderModoVoz: (respuesta: boolean) => void;
}

const CLAVE_MODO_VOZ = 'syntra.modoVoz';
const ContextoVoz = createContext<VoiceContexto | null>(null);

function leerModoVoz(): ModoVoz {
  const guardado = window.localStorage.getItem(CLAVE_MODO_VOZ);
  if (guardado === 'true') return true;
  if (guardado === 'false') return false;
  return null;
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [modoVoz, setModoVoz] = useState<ModoVoz>(leerModoVoz);

  useEffect(() => {
    if (modoVoz === null) {
      window.localStorage.removeItem(CLAVE_MODO_VOZ);
    } else {
      window.localStorage.setItem(CLAVE_MODO_VOZ, String(modoVoz));
    }
  }, [modoVoz]);

  const responderModoVoz = useCallback(
    (respuesta: boolean) => setModoVoz(respuesta),
    [],
  );

  useEffect(() => {
    const alPresionar = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.ctrlKey ||
        !event.altKey ||
        event.key.toLowerCase() !== 'v'
      ) {
        return;
      }

      event.preventDefault();
      const siguiente = modoVoz !== true;
      setModoVoz(siguiente);
      hablar(siguiente ? 'Modo voz activado' : 'Modo voz desactivado');
    };

    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [modoVoz]);

  const valor = useMemo(
    () => ({ modoVoz, setModoVoz, responderModoVoz }),
    [modoVoz, responderModoVoz],
  );

  return <ContextoVoz.Provider value={valor}>{children}</ContextoVoz.Provider>;
}

export function useVoice(): VoiceContexto {
  const contexto = useContext(ContextoVoz);
  if (!contexto) throw new Error('useVoice debe usarse dentro de VoiceProvider.');
  return contexto;
}
