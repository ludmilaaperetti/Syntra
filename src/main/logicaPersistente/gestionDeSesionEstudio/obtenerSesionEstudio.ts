import { Persistencia } from '../../persistencia/persistencia';
import { SesionEstudio } from './entidades';
import { SELECT_SESION_ESTUDIO } from './consultas';
import { materializarSesionEstudio } from './materializador';
import { DocumentoSesionEstudio } from '../../logicaNoPersistente/procesoSesionEstudio/documentoSesionEstudio';

// Abre una sesión: actualiza su último acceso y la devuelve completa.
// Solo encuentra sesiones del usuario que la pide.
// Si su Word de Material se editó por fuera (desde el visor), antes trae esos cambios a la sesión.
export class ObtenerSesionEstudio {
  constructor(
    private readonly persistencia: Persistencia,
    private readonly documento: DocumentoSesionEstudio
  ) {}

  async ejecutar(idUsuario: number, idSesion: number): Promise<SesionEstudio> {
    const actualizadas = await this.persistencia.ejecutar(
      `UPDATE sesion_estudio
          SET fecha_ultimo_acceso = now()
        WHERE id_sesion_estudio = $1 AND id_usuario = $2
        RETURNING id_sesion_estudio`,
      [idSesion, idUsuario]
    );
    if (actualizadas.length === 0) {
      throw new Error('La sesión de estudio no existe.');
    }

    // Si falla la lectura del Word, la sesión se abre igual con lo que tenía guardado.
    try {
      await this.traerCambiosDeMaterial(idSesion);
    } catch (error) {
      console.error('[ObtenerSesionEstudio] No se pudieron traer los cambios del Word:', error);
    }

    const filas = await this.persistencia.ejecutar(
      `${SELECT_SESION_ESTUDIO} WHERE s.id_sesion_estudio = $1`,
      [idSesion]
    );
    return materializarSesionEstudio(filas[0]);
  }

  private async traerCambiosDeMaterial(idSesion: number): Promise<void> {
    // Las fechas se comparan en la base para no mezclar zonas horarias.
    // Si la sesión todavía no tiene fecha de sincronización (es de antes de este cambio),
    // se toma como referencia su último guardado: el Word se escribe unos instantes después,
    // por eso el margen de 10 segundos.
    const filas = await this.persistencia.ejecutar(
      `SELECT s.id_archivo,
              CASE
                WHEN s.fecha_sync_documento IS NOT NULL
                  THEN a.ultima_fecha_modificacion > s.fecha_sync_documento
                ELSE a.ultima_fecha_modificacion > COALESCE(
                  (SELECT max(p.fecha_modificacion)::timestamp
                     FROM pestana_sesion p
                    WHERE p.id_sesion_estudio = s.id_sesion_estudio),
                  s.fecha_creacion::timestamp
                ) + interval '10 seconds'
              END AS cambio_externo
         FROM sesion_estudio s
         JOIN archivos a ON a.id_archivo = s.id_archivo
        WHERE s.id_sesion_estudio = $1`,
      [idSesion]
    );
    if (filas.length === 0) return;
    const { id_archivo: idArchivo, cambio_externo: cambioExterno } = filas[0];

    if (!cambioExterno) {
      await this.documento.marcarSincronizado(idSesion);
      return;
    }

    const html = await this.documento.leerHtml(idArchivo);
    await this.repartirEnPestanas(idSesion, html);
    await this.persistencia.ejecutar(
      `UPDATE sesion_estudio SET contenido = $2 WHERE id_sesion_estudio = $1`,
      [idSesion, html]
    );
    await this.documento.marcarSincronizado(idSesion);
  }

  // El Word lleva las pestañas una detrás de otra, cada una bajo su título (h1) si hay más de una.
  // Si coinciden la cantidad de títulos y de pestañas, cada parte vuelve a su pestaña.
  // Si no (por ejemplo, se borró un título en el Word), todo queda en la primera pestaña.
  private async repartirEnPestanas(idSesion: number, html: string): Promise<void> {
    const pestanas = await this.persistencia.ejecutar<{ id_pestana: number }>(
      `SELECT id_pestana FROM pestana_sesion WHERE id_sesion_estudio = $1 ORDER BY orden, id_pestana`,
      [idSesion]
    );
    if (pestanas.length === 0) return;

    const partes = html.split(/<h1[^>]*>.*?<\/h1>/s).slice(1);
    const coincide = pestanas.length > 1 && partes.length === pestanas.length;
    const contenidos = coincide ? partes : [html];

    for (let i = 0; i < pestanas.length; i++) {
      if (!coincide && i > 0) {
        await this.persistencia.ejecutar(`DELETE FROM pestana_sesion WHERE id_pestana = $1`, [pestanas[i].id_pestana]);
        continue;
      }
      await this.persistencia.ejecutar(
        `UPDATE pestana_sesion SET contenido = $2, fecha_modificacion = now() WHERE id_pestana = $1`,
        [pestanas[i].id_pestana, contenidos[i] ?? '']
      );
    }
  }
}