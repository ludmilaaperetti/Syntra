
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMBINAR, cuestionarioSchema, mapaMentalSchema, resumenSchema, type MapaMental } from '../../logicaNoPersistente/ia/esquemas';
import { extraerTexto } from '../../logicaNoPersistente/ia/extractorTexto';
import { fragmentar } from '../../logicaNoPersistente/ia/fragmentador';
import { ErrorValidacionIA, generarConEsquema } from '../../logicaNoPersistente/ia/generarConEsquema';
import { GeneradorMaterialIA } from '../../logicaNoPersistente/ia/generadorMaterialIA';
import type { ContextoTrabajo, RouterIA } from '../../logicaNoPersistente/ia/contratos';


const comprobar = (ok: boolean, mensaje: string): void => {
    if (!ok) throw new Error(mensaje);
};

const carpetaTemporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'syntra-ia-'));

const mapaValido: MapaMental = {
    titulo: 'Célula',
    nodos: [
        { id: 'r', texto: 'Célula', padreId: null },
        { id: 'a', texto: 'Organelas', padreId: 'r' },
        { id: 'b', texto: 'Mitocondria', padreId: 'a' },
    ],
};

// Router falso
function routerFalso(respuestas: string[], opciones: { demoraMs?: number } = {}): RouterIA & { llamadas: number; prompts: string[] } {
    const r = {
        llamadas: 0,
        prompts: [] as string[],
        generar: async ({ prompt, signal }: { prompt: string; signal: AbortSignal }) => {
            const texto = respuestas[Math.min(r.llamadas, respuestas.length - 1)];
            r.llamadas++;
            r.prompts.push(prompt);
            if (opciones.demoraMs) {
                await new Promise<void>((resolver, rechazar) => {
                    const t = setTimeout(resolver, opciones.demoraMs);
                    signal.addEventListener('abort', () => {
                        clearTimeout(t);
                        const e = new Error('abortado');
                        e.name = 'AbortError';
                        rechazar(e);
                    });
                });
            }
            return { texto, proveedor: 'falso' };
        },
    };
    return r;
}

const pedirMapa = (router: RouterIA, signal = new AbortController().signal) =>
    generarConEsquema(router, { prompt: 'p', schema: mapaMentalSchema, nombreSchema: 'mapaMental', signal });

// Contexto como el que le daría la cola: junta lo que se reporta.
const contextoFalso = (signal = new AbortController().signal) => {
    const reportes: string[] = [];
    const ctx: ContextoTrabajo = { signal, reportar: (parte, total) => { if (total) reportes.push(`${parte}/${total}`); } };
    return { ctx, reportes };
};


async function main(): Promise<void> {
    let bien = 0;
    let mal = 0;
    const caso = async (id: number, nombre: string, esperada: string, prueba: () => Promise<string>) => {
        console.log(`\nID: ${id}\nNombre: ${nombre}\nSalida esperada: ${esperada}`);
        try {
            const obtenida = await prueba();
            comprobar(obtenida === esperada, `Se obtuvo "${obtenida}"`);
            bien++;
            console.log(`Salida obtenida: ${obtenida}\nBIEN: ${nombre}`);
        } catch (error) {
            mal++;
            console.error(`Salida obtenida: ${String(error)}\nMAL: ${nombre}`);
        }
    };


    await caso(1, 'Cuestionario: rechaza una respuesta correcta que no existe', 'rechazado', async () => {
        const r = cuestionarioSchema.safeParse({
            titulo: 'T',
            preguntas: [{ enunciado: '¿?', opciones: ['a', 'b'], indiceCorrecta: 3, explicacion: 'e' }],
        });
        comprobar(!r.success && r.error.issues.some((i) => i.message.includes('no existe')), 'No avisó del índice');
        return 'rechazado';
    });

    await caso(2, 'Cuestionario: rechaza opciones repetidas', 'rechazado', async () => {
        const r = cuestionarioSchema.safeParse({
            titulo: 'T',
            preguntas: [{ enunciado: '¿?', opciones: ['Sí', 'sí'], indiceCorrecta: 0, explicacion: 'e' }],
        });
        return r.success ? 'aceptado' : 'rechazado';
    });

    await caso(3, 'Mapa mental: rechaza nodos que cuelgan de un nodo inexistente', 'rechazado', async () => {
        const r = mapaMentalSchema.safeParse({ ...mapaValido, nodos: [...mapaValido.nodos, { id: 'x', texto: 'X', padreId: 'zz' }] });
        return r.success ? 'aceptado' : 'rechazado';
    });

    await caso(4, 'Mapa mental: rechaza dos nodos centrales', 'rechazado', async () => {
        const r = mapaMentalSchema.safeParse({ ...mapaValido, nodos: [...mapaValido.nodos, { id: 'r2', texto: 'Otro', padreId: null }] });
        return r.success ? 'aceptado' : 'rechazado';
    });

    await caso(5, 'Resumen válido pasa la validación', 'aceptado', async () => {
        const r = resumenSchema.safeParse({ titulo: 'T', ideasClave: ['Idea'], secciones: [{ titulo: 'S', contenido: 'C' }] });
        return r.success ? 'aceptado' : 'rechazado';
    });

    await caso(6, 'Combinar mapas de dos fragmentos da un mapa válido', 'válido con 7 nodos', async () => {
        const combinado = COMBINAR.mapaMental([mapaValido, mapaValido], 'Apunte');
        comprobar(mapaMentalSchema.safeParse(combinado).success, 'El mapa combinado no es válido');
        return `válido con ${combinado.nodos.length} nodos`;
    });


    //Fragmentador

    await caso(7, 'Ningún fragmento supera el máximo de tokens', 'todos <= 1050', async () => {
        const texto = '# Intro\n' + 'Hola mundo. '.repeat(50)
            + '\n\n# Capítulo largo\n' + ('Oración de relleno para el capítulo. '.repeat(100) + '\n\n').repeat(6);
        const fragmentos = fragmentar(texto, { maxTokens: 1000, solapamientoTokens: 50 });
        comprobar(fragmentos.length > 2, 'No partió el capítulo largo');
        comprobar(fragmentos.every((f) => f.tokensAprox <= 1050), 'Hay fragmentos demasiado grandes');
        return 'todos <= 1050';
    });

    await caso(8, 'Corta por títulos numerados de PDF', 'Introducción | Organelas', async () => {
        // ~750 tokens cada sección: no entran juntas en 1000, así que queda una por fragmento.
        const texto = '1. Introducción\n' + 'a '.repeat(1500) + '\n2. Organelas\n' + 'b '.repeat(1500);
        return fragmentar(texto, { maxTokens: 1000 }).map((f) => f.titulo?.replace(/^\d+\.\s*/, '')).join(' | ');
    });


    //Reintento con zod

    await caso(9, 'Respuesta válida a la primera: una sola llamada', '1 llamada', async () => {
        const router = routerFalso([JSON.stringify(mapaValido)]);
        await pedirMapa(router);
        return `${router.llamadas} llamada`;
    });

    await caso(10, 'Acepta JSON envuelto en ```json', 'válido', async () => {
        const router = routerFalso(['```json\n' + JSON.stringify(mapaValido) + '\n```']);
        const { datos } = await pedirMapa(router);
        return datos.nodos.length === 3 ? 'válido' : 'inválido';
    });

    await caso(11, 'JSON inválido: reintenta y le pasa el error al modelo', '2 llamadas, con el error', async () => {
        const router = routerFalso(['{"titulo":"t","nodos":[]}', JSON.stringify(mapaValido)]);
        await pedirMapa(router);
        comprobar(router.prompts[1].includes('NO fue válida'), 'El segundo pedido no incluye el error');
        return `${router.llamadas} llamadas, con el error`;
    });

    await caso(12, 'Después de 3 respuestas inválidas se rinde', 'ErrorValidacionIA, 3 llamadas', async () => {
        const router = routerFalso(['no es json']);
        try {
            await pedirMapa(router);
        } catch (error) {
            return `${error instanceof ErrorValidacionIA ? 'ErrorValidacionIA' : String(error)}, ${router.llamadas} llamadas`;
        }
        return 'no falló';
    });

    await caso(13, 'Si ya se canceló, no llama al router', 'AbortError, 0 llamadas', async () => {
        const router = routerFalso([JSON.stringify(mapaValido)]);
        const controlador = new AbortController();
        controlador.abort();
        try {
            await pedirMapa(router, controlador.signal);
        } catch (error) {
            return `${(error as Error).name}, ${router.llamadas} llamadas`;
        }
        return 'no se canceló';
    });


    // ---------- Generador (extractor + fragmentador + zod + combinar) ----------

    const pdfParaGenerador = process.env.PDF_PRUEBA_IA;
    if (pdfParaGenerador) {
        await caso(14, 'Generador: arma un mapa desde un PDF y reporta el progreso', 'mapa válido, progreso 1/1', async () => {
            const router = routerFalso([JSON.stringify(mapaValido)]);
            const { ctx, reportes } = contextoFalso();
            const { contenido, proveedores } = await new GeneradorMaterialIA(router)
                .generar({ ruta: pdfParaGenerador, extension: 'pdf', nombre: 'Célula' }, 'mapaMental', ctx);
            comprobar(mapaMentalSchema.safeParse(contenido).success && proveedores[0] === 'falso', 'Resultado inválido');
            return `mapa válido, progreso ${[...new Set(reportes)].join(' ')}`;
        });
    }


    // Extractor

    await caso(15, 'Extractor: rechaza archivos que no son PDF ni DOCX', 'TIPO_NO_SOPORTADO', async () => {
        const archivo = path.join(carpetaTemporal(), 'a.txt');
        fs.writeFileSync(archivo, 'hola');
        try {
            await extraerTexto(archivo, 'txt');
        } catch (error) {
            return (error as { codigo?: string }).codigo ?? String(error);
        }
        return 'no falló';
    });

    const pdfPrueba = process.env.PDF_PRUEBA_IA;
    if (pdfPrueba) {
        await caso(16, 'Extractor: lee un PDF y une las palabras cortadas con guion', 'une "célula"', async () => {
            const { texto } = await extraerTexto(pdfPrueba, 'pdf');
            comprobar(texto.includes('celula mediante') || texto.includes('célula mediante'), `Texto: ${texto}`);
            return 'une "célula"';
        });
    }


    console.log(`\nResultado: ${bien} BIEN, ${mal} MAL.`);
    if (mal) process.exitCode = 1;
}


main().catch((error) => {
    console.error('MAL: Error al ejecutar las pruebas:', error);
    process.exitCode = 1;
});
