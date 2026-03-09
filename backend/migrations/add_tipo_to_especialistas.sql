-- Migración: Agregar columna 'tipo' a tabla especialistas
-- Fecha: 2026-03-06
-- Descripción: Agrega la columna 'tipo' para diferenciar entre Doctor y Cosmiatra

-- Agregar columna tipo con valor por defecto 'doctor'
ALTER TABLE especialistas ADD COLUMN tipo TEXT DEFAULT 'doctor';

-- Actualizar registros existentes (opcional, ya tienen el valor por defecto)
UPDATE especialistas SET tipo = 'doctor' WHERE tipo IS NULL;
