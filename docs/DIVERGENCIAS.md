# Divergencias: qué hace Atlas distinto del prototipo de Gildardo, y por qué

**Qué es.** La lista única de los puntos donde Atlas se aparta DELIBERADAMENTE del archivo prototipo de Gildardo (`ATLAS_v7.html` vigente). Responde la pregunta que se hace muchas veces: "¿por qué Atlas hace esto distinto de su prototipo?". Cada divergencia es intencional y autorizada (por su instrucción escrita o por una regla del proyecto), NO un error de port. Los errores de port se corrigen; las divergencias se conservan y se justifican aquí.

**Cómo se relaciona con el resto.** Cada divergencia apunta a la decisión que la autoriza (`D-NNN` en `DECISIONES_ANIBISE.md`) o a la regla de arquitectura. Este documento es una VISTA (junta lo que en el consolidado vive como campo "Divergencia" por decisión); la autoridad está en la decisión, aquí está la lista para encontrarlas.

---

## Ciencia congelada (frozen)

**DIV-1 · El examen de telómeros/estrés oxidativo se RETIRÓ del listado de exámenes sugeridos.**
- El prototipo lo incluye (cuando IAE > 5); Atlas (el artefacto que corre) no.
- Por qué: instrucción escrita de Gildardo (2026-08-03): no es examen de laboratorio estándar y citaba el propio modelo como referencia. Ver **D-012 / CA-1**.
- Cómo: por el mecanismo de modificaciones autorizadas (el original queda byte-idéntico; el generado lo omite). El manifiesto `frozen/authorized-modifications.js` tiene la instrucción verbatim.

**DIV-2 · El mapeo del índice contextual (ICEC) se mantiene APAGADO, pese a la instrucción de activarlo.**
- El prototipo trae el interruptor apagado; su instrucción (2026-08-03) dice activarlo; Atlas lo mantiene apagado.
- Por qué: su propio comentario en el archivo advierte "no poner en true sin resolver" la calibración μ/σ de la EB-BIS (excepción a la regla de autoridad: el archivo advierte contra su propia instrucción). Además hoy no se puede sin C9 (calcPatron) y la captura de d7_agua. Ver **D-006 / P-01**.

## Presentación y permisos

**DIV-3 · El administrador NO ve las cuatro pestañas de tratamiento por profesión.**
- El prototipo deja al admin verlas en solo-lectura; Atlas no le amplía esa visibilidad sobre contenido clínico.
- Por qué: la fidelidad al prototipo aplica a la FORMA, no a los permisos (separación operativo/clínico). Ver ARCHITECTURE "Regla frente al HTML de Gildardo".

---

*Cuando aparezca una divergencia nueva, entra aquí con su `DIV-N`, apuntando a la decisión que la autoriza. Si una deja de ser divergencia (Gildardo absorbe el cambio en su archivo), se retira con nota.*
