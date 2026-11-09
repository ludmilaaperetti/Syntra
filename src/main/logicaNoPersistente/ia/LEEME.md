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
└── index.ts              crearServiciosIA(): arma claves, proveedores, router y cola
```

## Regla de dependencias

Las dependencias van **en un solo sentido**, de abajo hacia arriba:

| Nivel | Archivos | Puede importar de |
|---|---|---|
| 1 | `tipos`, `errores`, `esquemas/*`, `prompts`, `fragmentador`, `extractorTexto` | nada del módulo (solo `tipos`) |
| 2 | `proveedores/*`, `routerModelos`, `colaEjecucion` | nivel 1 |
| 3 | `tareas` | nivel 1 |
| 4 | `generadorMaterialIA`, `index` | niveles 1 a 3 |

Ningún archivo de un nivel importa de un nivel más alto. Fuera del módulo, lo usan `ipc/ia.ipc.ts`, `ipc/materialIA.ipc.ts`, `administracionDePersistencia/materialIA.ts` y `index.ts`.

## Cómo se arma

En `src/main/index.ts`, dentro de `wireDependencies()`:

```ts
const ia = crearServiciosIA({ alProgreso: ... });          // claves, proveedores, router, cola
registrarIpcIA(ia);                                         // ia:generar, ia:cancelar, claves, conexión
new MaterialIA(..., new GeneradorMaterialIA(ia.router, ...), ia.cola, ...);
registerMaterialIAIpc(materialIA);                          // materialIA:generar / guardar / descartar / listar
```

Hay **una sola cola**. Todo el progreso sale por `ia:progreso` y todo se cancela con `ia:cancelar`.

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

Ninguna llama a una IA real.
