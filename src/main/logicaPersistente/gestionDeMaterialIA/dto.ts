import { z } from 'zod';
import { TIPOS_MATERIAL_IA } from '../../logicaNoPersistente/ia/tipos';

// Pedir a la IA un resumen, cuestionario o mapa mental de un archivo de Material.
export const generarMaterialIASchema = z.object({
  trabajoId: z.uuid({ error: 'Identificador de trabajo inválido.' }),
  idArchivo: z.number().int().positive(),
  tipo: z.enum(TIPOS_MATERIAL_IA, { error: 'Tipo de material inválido.' }),
  // Indicaciones del usuario para la IA ("nivel parcial", "más corto"...). Opcional.
  preferencias: z.string().trim().max(2000, { error: 'Las indicaciones no pueden superar los 2000 caracteres.' }).optional(),
});

export type GenerarMaterialIADTO = z.infer<typeof generarMaterialIASchema>;

// Descartar una propuesta sin guardarla. (Cancelar usa 'ia:cancelar', el de toda la IA.)
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
