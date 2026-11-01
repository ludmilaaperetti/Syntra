import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './app';
import './styles/globals.css';
import './styles/layout.css';
import { aplicarPreferencia } from './hooks/usarModo';
import { cargarReglas } from './permisos';
import { configurarLector } from './voz/narrador';

aplicarPreferencia();

// Antes de mostrar la app: cargar permisos y saber si hay lector de pantalla,
// así la primera frase ya sale por el lado correcto.
Promise.all([
  cargarReglas().catch((e) => console.error('No se pudieron cargar los permisos', e)),
  window.api.lectorPantallaActivo().then(configurarLector).catch(() => configurarLector(false)),
]).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
});
