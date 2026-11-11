import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { hablar } from './narrador';

const PANTALLAS: Record<string, string> = {
  '/': 'Inicio de sesión',
  '/registro': 'Registro',
  '/dashboard': 'Bienvenida a Syntra. Estás en el inicio',
  '/material': 'Material de estudio',
  '/eventos': 'Calendario',
  '/horarios': 'Horarios',
  '/cronograma': 'Cronograma',
  '/perfil': 'Perfil',
  '/ajustes': 'Ajustes',
  '/metodos': 'Métodos de estudio',
  '/repeticion-espaciada': 'Repetición espaciada',
  '/flashcards': 'Flashcards',
  '/sesiones': 'Sesiones de estudio',
  '/sesiones/nueva': 'Nueva sesión de estudio',
};

// Las rutas con id (/flashcards/3, /sesiones/7) usan el nombre de su sección.
function nombreDePantalla(ruta: string): string | undefined {
  return PANTALLAS[ruta] ?? PANTALLAS['/' + ruta.split('/')[1]];
}

// Cada vez que cambia la pantalla, la anuncia (con la voz de Syntra o con el lector de pantalla).
export function AnunciarPantalla() {
  const { pathname } = useLocation();

  useEffect(() => {
    const nombre = nombreDePantalla(pathname);
    if (nombre) hablar(nombre);
  }, [pathname]);

  return null;
}
