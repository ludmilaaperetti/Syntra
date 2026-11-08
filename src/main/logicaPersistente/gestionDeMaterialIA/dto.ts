import { z } from 'zod';
import { TIPOS_MATERIAL_IA } from '../../logicaNoPersistente/ia/tipos';

// Pedir a la IA un resumen, cuestionario o mapa mental de un archivo de Material.
export const generarMaterialIASchema = z.object({
  trabajoId: z.uuid({ error: 'Identificador de trabajo inválido.' }),
  idArchivo: z.number().int().positive(),
  tipo: z.enum(TIPOS_MATERIAL_IA, { error: 'Tipo de material inválido.' }),
});

export type GenerarMaterialIADTO = z.infer<typeof generarMaterialIASchema>;

// Cancelar un trabajo en curso o descartar una propuesta sin guardarla.
export const trabajoIASchema = z.object({
  trabajoId: z.uuid({ error: 'Identificador de trabajo inválido.' }),
});

export type TrabajoIADTO = z.infer<typeof trabajoIASchema>;

// Confirmar la propuesta revisada. El contenido se valida con el esquema del tipo
export const guardarMaterialIASchema = z.object({
  trabajoId: z.uuid({ error: 'Identificador de trabajo inválido.' }),
  contenido: z.unknown(),
});

export type GuardarMaterialIADTO = z.infer<typeof guardarMaterialIASchema>;

export const listarMaterialesIASchema = z.object({
  idArchivo: z.number().int().positive().optional(),
});

export type ListarMaterialesIADTO = z.infer<typeof listarMaterialesIASchema>;
