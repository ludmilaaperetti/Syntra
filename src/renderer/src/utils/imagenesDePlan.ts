// src/renderer/src/utils/imagenesDePlan.ts
// Convierte el archivo del plan en imágenes (JPEG en base64, sin "data:...") para que la IA las lea
// cuando la app no puede sacar el texto: PDF escaneado → cada página dibujada en un canvas; foto → tal cual.
// Se hace acá porque el renderer ya tiene pdf.js y un canvas (el main no).
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// Tienen que coincidir con planArchivo.ipc.ts.
export const MAX_PAGINAS_PLAN = 12;
const ANCHO_OBJETIVO = 1500; // px: alcanza para leer tablas chicas sin mandar imágenes enormes
const CALIDAD_JPEG = 0.85;

export const EXTENSIONES_IMAGEN = ['png', 'jpg', 'jpeg', 'webp'];

const sinPrefijo = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

async function pdfAImagenes(datos: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(datos) }).promise;
  try {
    const imagenes: string[] = [];
    const total = Math.min(pdf.numPages, MAX_PAGINAS_PLAN);
    for (let n = 1; n <= total; n++) {
      const pagina = await pdf.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: Math.min(3, ANCHO_OBJETIVO / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const contexto = canvas.getContext('2d');
      if (!contexto) throw new Error('No se pudo preparar la imagen del PDF.');
      contexto.fillStyle = '#ffffff'; // fondo blanco: el JPEG no tiene transparencia
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
      imagenes.push(sinPrefijo(canvas.toDataURL('image/jpeg', CALIDAD_JPEG)));
      pagina.cleanup();
    }
    return imagenes;
  } finally {
    await pdf.destroy();
  }
}

// Una foto se pasa a JPEG y se achica si es muy grande (las fotos del celular pesan mucho).
async function imagenAJpeg(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    await new Promise<void>((resolver, rechazar) => {
      imagen.onload = () => resolver();
      imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
      imagen.src = url;
    });
    const escala = Math.min(1, 2000 / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imagen.naturalWidth * escala);
    canvas.height = Math.round(imagen.naturalHeight * escala);
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se pudo preparar la imagen.');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return sinPrefijo(canvas.toDataURL('image/jpeg', CALIDAD_JPEG));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Las páginas del plan como imágenes. Devuelve [] si el tipo de archivo no se puede pasar a imagen. */
export async function imagenesDePlan(archivo: File): Promise<string[]> {
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'pdf') return pdfAImagenes(await archivo.arrayBuffer());
  if (EXTENSIONES_IMAGEN.includes(extension)) return [await imagenAJpeg(archivo)];
  return [];
}
