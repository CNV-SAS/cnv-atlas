-- Retiro del cruce de alergenos y del cruce de patron alimentario.
--
-- POR QUE. Instruccion de Gildardo del 2026-08-27 (§10), bajo su regla 0 ("el software representa el
-- archivo, literalmente; no puede tener mas, no puede tener menos"):
--
--   "Nada de tablas de alergenos, ni de equivalencias, ni de filtros. Retiren las dos tablas. Lo que el
--    sistema tiene que hacer es que aparezca que el paciente tiene alergias alimentarias, tal como la
--    encuesta lo capturo. El profesional indagara cuales en la consulta y vera como las trata."
--
-- Las tablas de traduccion (Mariscos -> camaron/langostino/langosta/calamar) y de exclusiones por patron
-- eran contenido clinico que redactamos NOSOTROS y que su archivo no tiene. Con ellas se cae todo lo que
-- colgaba: el filtro en codigo, el bloqueo del menu y el descarte con motivo.
--
-- QUE NO SE RETIRA, y es deliberado: `menu_json` SE QUEDA. Nacio para poder cruzar alimento contra
-- alimento, pero su otra razon sigue viva y es la que manda hoy: es lo que permite renderizar y editar
-- el menu semanal por celda y conectarlo con la lista de intercambio. Sobre prosa libre nada de eso es
-- posible. Retirarlo seria confundir el mecanismo clinico (que se va) con la forma del dato (que se queda).
--
-- FORWARD-ONLY: las migraciones 0086, 0087 y 0088 quedan como estan (ya aplicadas); esta las revierte.
-- Los datos de las columnas se pierden a proposito: son hallazgos de un mecanismo retirado, no historia
-- clinica. Los descartes que se hayan registrado siguen en `clinical_audit_log`, que es inmutable, asi
-- que la traza de quien descarto que no desaparece; lo que desaparece es el estado que la pantalla leia.

ALTER TABLE ai_menu_suggestions DROP COLUMN IF EXISTS alergenos_detectados;
ALTER TABLE ai_menu_suggestions DROP COLUMN IF EXISTS patron_conflictos;

DROP TABLE IF EXISTS menu_allergen_dismissals;
