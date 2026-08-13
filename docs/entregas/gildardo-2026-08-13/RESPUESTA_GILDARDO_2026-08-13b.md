# Respuesta a la ronda del 2026-08-13

**De:** Gildardo Uribe — Dirección Científica CNV
**Para:** Equipo Atlas
**Fecha:** 13 de agosto de 2026

Una pregunta y el archivo. Va todo.

---

## 1. El radar funcional · unifiquen, tienen razón

**El radar mide exactamente lo mismo que la severidad por dominio.** No son dos escalas a propósito: es una escala con dos vocabularios.

Lo comprobé en el archivo antes de responder, y el código lo dice sin ambigüedad:

```js
const _RAD_SEV2ZONE = [1, 2, 3, 4];
const _radSevZone = s => _RAD_SEV2ZONE[Math.max(0, Math.min(3, s))];
```

El radar se alimenta de la misma `sev` que las tarjetas y solo la reetiqueta.

**Y hay un detalle que cierra el asunto:** los rótulos son cinco, pero `_radSevZone` solo puede devolver del 1 al 4. **"Excepcional" es inalcanzable.** Ninguna severidad llega a esa banda; existe en la leyenda y no se pinta nunca.

Así que su unificación es correcta y además corrige un defecto que yo no había visto. Queda así:

- Radar y tarjetas, **la misma escala y el mismo vocabulario**
- Se elimina **"Excepcional"**, que nunca se alcanza

Con eso, radar y tarjetas no pueden divergir, que era su preocupación de fondo.

---

## 2. El archivo · el fallo fue mío

Tienen razón en que no llegó. En mi respuesta escribí "va adjunto el actualizado" y **no adjunté nada**. El archivo va con este documento.

Es el `ATLAS_v8.html` al día. Lo que cambió desde el que tienen, el del 4 de agosto:

| Cambio | Fecha |
|---|---|
| Carnes rojas: lógica de color propia para los grupos moderados | 12-ago |
| `MCA_ref` de 50 % a **52,4 %** de la MLG, con la procedencia anotada | 12-ago |
| `hidSG_ref` marcada como REFERENCIADA (Pace-Rathbun / Wang) | 12-ago |
| Salvaguarda de TCA: avisa, ya no bloquea el déficit | 9-ago |
| Renombre del eje estructural a E1-E9 y unificación del funcional en A1-A9 | 9-ago |
| Condición de activación del ICEC anotada junto a la bandera | 9-ago |
| **Déficit por fenotipo retirado en los cinco casos** | **13-ago** |
| **Vocabulario de severidad unificado y radar reducido a cuatro bandas** | **13-ago** |

**El archivo va al día con todas las decisiones, incluidas las de hoy.** No queda ninguna discrepancia conocida entre el documento y el HTML. Pueden cotejar directamente contra él.

### Qué encontrarán en las dos últimas

**El déficit por fenotipo.** Los cinco casos devuelven ahora `deficit: 0` y la etiqueta *"Mantenimiento · el objetivo calórico lo define el profesional"*. La orientación clínica del fenotipo no se pierde: pasa a un campo `perfil`, como texto y **sin cifra** — por ejemplo *"Perfil de obesidad sarcopénica: preservar masa magra, evitar restricción agresiva"*. Las referencias ESPEN se conservan intactas.

**El vocabulario.** `_DFI_SEVL` pasó de `["Óptimo","Vigilancia","Moderado","Crítico"]` a **`["Bajo","Leve","Moderado","Alto"]`**, que es el del clasificador. Aquí les debo una: el §11a del 9 de agosto zanjó esto y yo no lo había aplicado al prototipo, así que el archivo que tenían llevaba el vocabulario que yo mismo había descartado.

**El radar.** Cuatro bandas en vez de cinco, mapeo identidad (`_RAD_SEV2ZONE = [0,1,2,3]`), mismos rótulos y mismos colores que las tarjetas. La banda "Excepcional" ya no existe. Aplicado también a la copia del informe imprimible, para que pantalla e impresión no puedan divergir.

---

## Estado

Con esto queda cerrado el cotejo de Diagnóstico. **No queda nada pendiente de mi lado**: ni preguntas por responder, ni cambios por aplicar al prototipo, ni el archivo.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
