# Módulo de IA

Todo lo de inteligencia artificial vive en esta carpeta. No guarda nada en la base de datos; eso lo hace `logicaPersistente/gestionDeMaterialIA`.

## Estructura

```
ia/
├── tipos.ts              Tipos de todo el módulo (tareas, fuentes, router, proveedores)
├── errores.ts            ErrorProveedor, ErrorRouter, ErrorAbortado, clasificar()
├── esquemas/             Esquemas zod: qué forma tiene que tener la respuesta de la IA
│   ├── resumen.ts
│   ├── cuestionario.ts
│   ├── mapaMental.ts
│   ├── flashcards.ts
│   └── index.ts          Exporta todos + aJsonSchema() + COMBINAR (une fragmentos)
├── prompts.ts            Reglas comunes + instrucciones de cada tarea + armarUsuario()
├── tareas.ts             Registro ÚNICO de tareas: prompt + esquema zod + JSON Schema
├── extractorTexto.ts     PDF (pdfjs-dist) y DOCX (mammoth) → texto
├── fragmentador.ts       Corta por títulos y por tokens
├── proveedores/          Hablan con cada IA
│   ├── proveedorLuna.ts      Azure (principal)
│   ├── proveedorGemini.ts    Gemini (respaldo)
│   ├── proveedorOllama.ts    Gemma local (sin internet)
│   └── almacenClaves.ts      Claves cifradas con safeStorage, por instancia
├── routerModelos.ts      Luna → Gemini → Gemma, valida con zod y reintenta con el error
├── colaEjecucion.ts      Cola con cancelación y progreso ("parte 3 de 8")
├── generadorMaterialIA.ts  Archivo → texto → fragmentos → router → combinar (para la pantalla previa)
├── asistenteChat.ts      Chat con IA: historial + pregunta → router (tarea 'chat')
└── index.ts              crearServiciosIA(): arma claves, proveedores, router y cola
```

## Regla de dependencias

Las dependencias van **en un solo sentido**, de abajo hacia arriba:

| Nivel | Archivos | Puede importar de |
|---|---|---|
| 1 | `tipos`, `errores`, `esquemas/*`, `prompts`, `fragmentador`, `extractorTexto` | nada del módulo (solo `tipos`) |
| 2 | `proveedores/*`, `routerModelos`, `colaEjecucion` | nivel 1 |
| 3 | `tareas` | nivel 1 |
| 4 | `generadorMaterialIA`, `asistenteChat`, `index` | niveles 1 a 3 |

Ningún archivo de un nivel importa de un nivel más alto. Fuera del módulo, lo usan `ipc/ia.ipc.ts`, `ipc/materialIA.ipc.ts`, `ipc/chatIA.ipc.ts`, `administracionDePersistencia/materialIA.ts`, `administracionDePersistencia/chatIA.ts` y `index.ts`.

## Cómo se arma

En `src/main/index.ts`, dentro de `wireDependencies()`:

```ts
const ia = crearServiciosIA({ alProgreso: ... });          // claves, proveedores, router, cola
registrarIpcIA(ia);                                         // ia:generar, ia:cancelar, claves, conexión
new MaterialIA(..., new GeneradorMaterialIA(ia.router, ...), ia.cola, ...);
registerMaterialIAIpc(materialIA);                          // materialIA:generar / guardar / descartar / listar
```

Hay **una sola cola**. Todo el progreso sale por `ia:progreso` y todo se cancela con `ia:cancelar`.

## Métodos de estudio (lo que ve el usuario)

| Tipo | Pantalla previa | Dónde se ve |
|---|---|---|
| Resumen | Sí: se revisa y edita antes de guardar | Métodos → Resúmenes (`/resumenes`) |
| Mapa mental | Sí | Métodos → Mapas Mentales (`/mapas-mentales`), dibujado con nodos y líneas |
| Cuestionario | **No**: se verían las respuestas. Se guarda solo en el main y se abre para resolver | Métodos → Cuestionarios (`/cuestionarios`) |

Se generan desde Material (botón **Generar con IA** en un PDF o Word) o desde cada lista de Métodos (**Generar desde Material**). En los dos casos se pueden escribir indicaciones para la IA.

**Cuestionarios:**

- Tienen tres tipos de pregunta: opción múltiple, completar eligiendo y completar escribiendo (las de completar tienen un hueco `___`).
- Cada pregunta lleva un **tema**.
- Las respuestas correctas **nunca llegan al front** antes de corregir: `MaterialIA.sinRespuestas()` las saca.
- La corrección la hace el main (`gestionDeMaterialIA/corregirCuestionario.ts`). En lo escrito no importan mayúsculas, tildes ni signos, y en palabras de 5 letras o más se perdona un error de tipeo.
- Cada intento se guarda en `intentos_cuestionario` con los **temas a reforzar** (los temas de las preguntas que estuvieron mal).

## Chat con IA (ítem **Chat** de la barra lateral, `/chat`)

- Se pregunta lo que sea; responde la IA disponible con la misma cadena que el resto (Luna → Gemini → Gemma sin internet).
- Es la tarea `chat` del registro: el esquema es `{ respuesta }` (`esquemas/chat.ts`), así pasa por el mismo router que valida y reintenta.
- `prompts.armarChat()` manda los últimos mensajes (hasta ~12.000 caracteres) entre `<<<HISTORIAL>>>` y la pregunta entre `<<<MENSAJE>>>`.
- Se guarda en `conversaciones_ia` y `mensajes_ia` (`logicaPersistente/gestionDeChatIA`). La pregunta y la respuesta se guardan **juntas y recién cuando la IA respondió** (en una transacción): si se cancela o falla, no queda nada a medias y la pregunta vuelve al cuadro de texto.
- El título de una conversación nueva sale de la primera pregunta; se puede cambiar desde la lista.
- Para cortar una respuesta se usa `ia:cancelar` con el `trabajoId` del mensaje (la cola es una sola).

## Agregar una tarea (guía de preguntas, plan, materias...)

1. Crear el esquema zod en `esquemas/` y exportarlo en `esquemas/index.ts`.
2. Escribir su instrucción en `prompts.ts`, partiendo de `REGLAS_COMUNES`.
3. Agregar una entrada en `tareas.ts`.
4. Si se genera desde Material y pasa por la pantalla previa, sumarla también a `TIPOS_MATERIAL_IA` (`tipos.ts`), a `COMBINAR`, al `CHECK` de la tabla `materiales_ia` y al editor de `pantallaPrevia.tsx`.

El router y la cola no cambian.

## Configuración (.env)

| Variable | Para qué |
|---|---|
| `AZURE_RECURSO`, `AZURE_DESPLIEGUE`, `AZURE_OPENAI_API_KEY` | Luna |
| `GEMINI_MODELO`, `GEMINI_API_KEY` | Gemini |
| `OLLAMA_HOST`, `OLLAMA_MODELO` | Gemma: el nombre exacto que muestra `ollama list` |
| `IA_MAX_TOKENS_FRAGMENTO` | Tamaño de cada fragmento (por defecto 3000) |

Las claves del `.env` se usan solo en desarrollo. En la app instalada, el usuario las carga y se guardan cifradas.

## Pruebas

```
npm test
```

Están en `src/main/tests/ia/` y usan vitest:

| Archivo | Qué prueba |
|---|---|
| `router.test.ts` | El router |
| `cola.test.ts` | La cola |
| `claves.test.ts` | El almacén de claves |
| `esquemas.test.ts` | Los esquemas |
| `fragmentador.test.ts` | El fragmentador |
| `prompts.test.ts` | Los prompts y el registro de tareas |
| `extractorTexto.test.ts` | El extractor |
| `generadorMaterialIA.test.ts` | El flujo completo de Material con IA, con el router y la cola reales y una IA falsa |
| `chat.test.ts` | El pedido del chat (historial, delimitadores), el asistente y el título de las conversaciones |

Ninguna llama a una IA real.
