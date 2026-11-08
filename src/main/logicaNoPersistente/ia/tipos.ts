// Archivos de fuente aceptados.
export const EXTENSIONES_FUENTE_IA = ['pdf', 'docx'] as const;
export type ExtensionFuenteIA = (typeof EXTENSIONES_FUENTE_IA)[number];

export const esFuenteIA = (extension: string): extension is ExtensionFuenteIA =>
  (EXTENSIONES_FUENTE_IA as readonly string[]).includes(extension.toLowerCase());

// Lo que se le puede pedir a la IA 
export const TIPOS_MATERIAL_IA = ['resumen', 'cuestionario', 'mapaMental'] as const;
export type TipoMaterialIA = (typeof TIPOS_MATERIAL_IA)[number];
