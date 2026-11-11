# Syntra · Módulo de IA (Router + Claves + Cola)

Luna (principal) → Gemini (alternativa) → Gemma/Ollama (sin conexión o si fallan los dos).

## 1. Dónde va cada archivo (copiá `src/` dentro de tu `src/`)

```
src/main/
├─ servicios/ia/
│  ├─ ProveedorLuna.ts       Azure OpenAI / Foundry
│  ├─ ProveedorGemini.ts
│  ├─ ProveedorOllama.ts     Gemma local (HTTP a Ollama)
│  ├─ GestorOllama.ts        inicia Ollama y descarga el modelo al abrir la app
│  └─ AlmacenClaves.ts       claves cifradas con safeStorage
├─ logicaNoPersistente/ia/
│  ├─ tipos.ts               contrato: ProveedorModelo, PedidoGeneracion...
│  ├─ errores.ts             ErrorProveedor, ErrorRouter, clasificar()
│  ├─ RouterModelos.ts       fallback, timeout, enfriamiento, probar()
│  ├─ ColaEjecucion.ts       cola con cancelación y progreso
│  ├─ esquemas.ts            zod: resumen, flashcards
│  ├─ prompts.ts             instrucciones fijas + delimitadores anti-injection
│  ├─ fragmentar.ts          fragmentador simple (reemplazable por el tuyo)
│  ├─ postproceso.ts         une los fragmentos y descarta lo inventado
│  ├─ tareasIA.ts            registro de tareas (resumen, flashcards, cuestionario)
│  └─ index.ts               raíz de composición: crearServiciosIA()
├─ ipc/ia.ipc.ts             canales ia:*
└─ tests/ia/                 ayudas + router, cola, claves, fragmentar
src/preload/ia.preload.ts    iaApi para window.api.ia
```

## 2. Instalación

```
npm i openai @google/genai zod@^4
npm i -D vitest        # si todavía no lo tenés
```
Gemma usa `fetch` contra Ollama: no necesita paquete. Agregá a `package.json`:
`"test:ia": "vitest run src/main/tests/ia"`

## 3. Conectar en tu proyecto (3 cambios)

**a) `src/main/index.ts`**: carpeta por instancia ANTES de usar userData, y registrar el IPC.
```ts
import { app, BrowserWindow } from 'electron';
import { crearServiciosIA } from './logicaNoPersistente/ia/index.js';
import { registrarIpcIA } from './ipc/ia.ipc.js';

const carpeta = process.env.SYNTRA_DATA_DIR;           // ej: ./electron-data-1
if (carpeta) app.setPath('userData', carpeta);

app.whenReady().then(() => {
  const ia = crearServiciosIA({
    alProgreso: (e) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('ia:progreso', e)),
  });
  registrarIpcIA(ia);
  // ...tu createWindow()
});
```
Para desarrollo con `.env`, cargá `dotenv` solo si `!app.isPackaged`. No uses prefijos `VITE_` ni `MAIN_VITE_` para claves.

**b) `src/preload/index.ts`**: sumá `ia` a lo que ya exponés.
```ts
import { iaApi } from './ia.preload';
contextBridge.exposeInMainWorld('api', { ...tuApiActual, ia: iaApi });
```
Tipos del renderer (en tu `.d.ts` de `window.api`): `ia: import('../preload/ia.preload').ApiIA`.

**c) `.env`, `.gitignore`**: copiá `.env.example` y agregá `gitignore-agregar.txt`.

## Formato de respuesta de `ia:generar`
`{ ok: true, dato: { contenido, proveedores } }` o `{ ok: false, causa, mensaje }`.
`contenido` es el resultado ya combinado y validado; `proveedores` dice qué modelo(s) respondieron.
Causas: `cancelado`, `sin_proveedor`, `sin_contenido_valido`, `pedido_invalido`, `desconocido`.
Para agregar una tarea nueva: esquemas.ts, prompts.ts, postproceso.ts y tareasIA.ts (ver la guía .docx).

## 3 bis. Conectar SOLO Gemini y Gemma (sin Azure todavía)
No hace falta tocar código: con Azure sin configurar, Luna se saltea sola (`sin_clave`) y la cadena queda Gemini → Gemma.

1. `npm i dotenv` y en `src/main/index.ts`, ANTES de `crearServiciosIA`:
   `import { config } from 'dotenv'; if (!app.isPackaged) config();`
2. `.env` (copia de `.env.example`), dejando Azure vacío:
```
GEMINI_API_KEY=pegá-tu-clave
GEMINI_MODELO=gemini-3.6-flash      # confirmalo en ai.google.dev/gemini-api/docs/models
OLLAMA_MODELO=gemma4:e2b            # el que muestre `ollama list` (e4b si tenés 16 GB)
```
3. Reiniciá la app (las variables se leen al arrancar) y usá "Probar conexión" para gemini y gemma.

## 3 ter. Ollama automático al abrir la app
`GestorOllama` al arrancar: (1) si Ollama no responde, lo inicia con `ollama serve`; (2) si el modelo falta, lo
**descarga solo** (~4,6 GB, una vez) y avisa el progreso. Para que pregunte antes: `OLLAMA_AUTO_DESCARGA=0` en el `.env`.
El modelo por defecto es `gemma4:e2b` (se cambia con `OLLAMA_MODELO`). NO instala Ollama: eso es una vez por compu.
En `main/index.ts`, dentro de `app.whenReady()` y después de `wireDependencies()`:
```ts
iaServicios = crearServiciosIA({
  alProgreso: (e) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('ia:progreso', e)),
  alOllama: (e) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('ia:ollama', e)),
});
registrarIpcIA(iaServicios);
// ...después de createWindow():
void iaServicios?.gestorOllama.preparar();   // sin await: no frena el arranque
```
Y en `before-quit`: `iaServicios?.gestorOllama.detener();` (apaga solo el Ollama que inició la app).
Eventos (`ia:ollama`): iniciando, listo, no_instalado, no_arranco, falta_modelo, descargando {estado, porcentaje}, error.

## 4. Si algo falla
- Ollama "no disponible": el servicio no corre, o `OLLAMA_MODELO` no coincide con `ollama list` (`gemma4` y `gemma4:latest` se aceptan como iguales).
- `ERR_REQUIRE_ESM` con una dependencia: `externalizeDepsPlugin({ exclude: ['esa-dependencia'] })` en `electron.vite.config.ts`.
- Los imports llevan `.js` aunque el archivo sea `.ts` (con `moduleResolution` `bundler` o `NodeNext` funciona). Si tu proyecto no los usa, quitá la extensión.
- 404 en Luna: el nombre de **despliegue** no coincide con el de Foundry.
- `safeStorage`: la API síncrona está marcada como obsoleta (retiro previsto en Electron 46); si tu Electron trae la asíncrona, migrá `AlmacenClaves`.
- Luna/Gemini rechazan el esquema: no uses `.optional()` en zod, usá `.nullable()`.

## 5. Estado de verificación
Verificado con `tsc --strict` y ejecución real (Electron y Ollama simulados, sin internet):
- 33 tests (verificados con una réplica de la API de vitest): router (fallback, timeout, enfriamiento, probar), cola (concurrencia, cancelación, progreso), claves, fragmentador y prompts.
- Esquemas: el JSON Schema sale sin `$schema` y con `additionalProperties: false` y todos los campos en `required`; `validarFuentes` descarta duplicados e inventos.
- Punta a punta por IPC: sin internet responde Gemma con progreso 4/4; cancelar a mitad corta y no activa el respaldo; los pedidos inválidos se rechazan; las claves se guardan cifradas y el renderer solo recibe la enmascarada; `estadoOllama` y `probarConexion`; con todo caído devuelve `sin_proveedor`.

**No verificado (no se puede sin tus cuentas y tu entorno):**
- Los adaptadores de Luna y Gemini contra los SDK reales y tus claves (nombres de campos, URL de Azure, `temperature`/`max_completion_tokens`).
- Gemma con tu Ollama real y el tag exacto.
- `safeStorage` real de Electron (el de las pruebas es una simulación) y el empaquetado con electron-vite.
- Los tests están escritos para **vitest**; los verifiqué con una réplica mínima de su API, no con vitest real. Si alguno falla por una diferencia de vitest, avisame.
