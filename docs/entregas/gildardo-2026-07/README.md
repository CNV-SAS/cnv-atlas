Estos `.js` NO son el motor que corre. El motor vigente vive en `src/clinical-engine/frozen/` (congelado, regla dura 12). Los archivos de esta carpeta son artefactos ENTREGADOS por Gildardo como referencia (2026-07), no codigo en produccion.

# Entrega de Gildardo 2026-07

Inventario completo y decisiones: ver `INVENTARIO.md`.

## Contenido
- **7 modulos `.js`** (`atlas-core-indices.js`, `atlas-encuesta-patron.js`, `atlas-dfi.js`, `atlas-resumen-clinico.js`, `atlas-motores-tratamiento.js`, `atlas-lista-intercambio.js`, `atlas-menu-ciclo.js`): re-extraccion del HTML para migrar a software en linea. Referencia para portar (Tratamiento, Diagnostico de encuesta), NO se importan desde la app.
- **Docs de orientacion**: `LEEME.md`, `CHANGELOG.md`, `MAPA-FUNCIONES.md`, `diff-indicadores.md`.
- **`INVENTARIO.md`**: nuestro inventario y las decisiones (que llego, que falta, EB-BIS ya es v5, mecanismo de custodia).
- **`ATLAS.html`**: estado actual del prototipo. **ANONIMIZADO (nombres) y con CREDENCIALES REDACTADAS** (ver abajo).

## ATLAS.html: anonimizado y con credenciales redactadas (por que difiere del original de Gildardo)

Este `ATLAS.html` NO es byte-identico al que entrego Gildardo. Se modifico antes de dejarlo en el repo por dos razones, ambas de higiene (el HTML es solo referencia, no corre, asi que nada de esto cumple funcion):

**1. Nombres del caso demo (PII).** Se reemplazaron los dos nombres del objeto de demostracion `DEMO` (~L6252):

| Linea | Original | Reemplazo |
|---|---|---|
| L6254 | `nombre: "<paciente demo>"` | `nombre: "Paciente Demo"` |
| L6258 | `profesional: "<profesional demo>, ND"` | `profesional: "Profesional Demo, ND"` |

**2. Credenciales incrustadas (secretos).** Gildardo dejo credenciales hardcodeadas en el HTML (GitHub push protection bloqueo el push por la clave de Groq). Se redactaron las TRES:

| Linea(s) | Que | Reemplazo |
|---|---|---|
| L11758, L14157 | Clave API de Groq | `GROQ_API_KEY_REDACTED` |
| L30 | Clave publishable de Supabase | `sb_publishable_REDACTED` |
| L29 | Ref del proyecto Supabase (en la URL) | `PROYECTO_SUPABASE_REDACTED.supabase.co` |

Como la clave de Groq estaba en un commit del historial (no basta borrarla en un commit nuevo), se **reescribio el historial** con `git rebase --onto` para que el secreto **nunca** haya estado en ningun commit; el push nunca llego a GitHub (fue rechazado por push protection). **Recomendacion:** rotar la clave de Groq del lado de Gildardo (vivio en un archivo entregado; tratarla como expuesta).

- **Todo lo demas es verbatim.** Solo cambiaron esos strings (2 nombres + 3 credenciales).
- **Los numeros de linea se preservan** (16724 lineas, igual que el original): las referencias de linea en `INVENTARIO.md` y en los encabezados del motor siguen siendo validas.
- El barrido de PII sobre las 16724 lineas no encontro correos, telefonos, documentos ni fechas de nacimiento de personas reales (los correos/telefonos que hay son placeholders o el contacto corporativo `privacidad@cnvnutricion.com` del texto de consentimiento; los campos de documento/cedula son etiquetas de UI, no numeros).
- **El original sin anonimizar lo guarda Santiago en local, fuera del repo**, por si alguna vez hace falta verificar fidelidad byte a byte contra la entrega de Gildardo.

## No incluido en el repositorio
- **El bundle de `atlas-gil/`** (binario, pertenece a otro repo `CNV-SAS/atlas-gil`): su contenido esta documentado como especificacion en `INVENTARIO.md` (punto 5). No se commitea.

## Regla mientras se migra
No editar la misma pieza en el HTML y en un `.js` a la vez. El HTML sigue siendo la fuente hasta que el backend/online tome el relevo. La ciencia congelada (`src/clinical-engine/frozen/`) solo cambia del lado de Gildardo (regla dura 12).
