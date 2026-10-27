-- Cuándo se sincronizó por última vez la sesión con su Word de Material.
-- Si el Word se modificó después (por ejemplo, editándolo desde el visor de Material),
-- al abrir la sesión se traen esos cambios.
ALTER TABLE sesion_estudio
  ADD COLUMN IF NOT EXISTS fecha_sync_documento TIMESTAMP NULL;