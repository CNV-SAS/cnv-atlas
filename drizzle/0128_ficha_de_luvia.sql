-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA FICHA DE LUVIA, PORTADA DE SU ARCHIVO  ·  2026-09-11
--
-- La 0124 cargo lo comercial (precio, propiedad, titular, reparto) y dejo la ficha en blanco. Los datos
-- estaban desde el 26 de agosto en el archivo de Direccion Cientifica y no los habiamos leido:
-- `OTROS_PRODUCTOS` del ATLAS_v8, verbatim.
--
-- ── POR QUE IMPORTA Y NO ES COSMETICO ───────────────────────────────────────────────────────────
--
-- EL REGISTRO SANITARIO era uno de los dos bloqueantes abiertos antes de la primera venta de producto de
-- tercero, y estaba "sin verificar" cuando en realidad estaba escrito en su archivo. Que viva en un
-- documento y no en Atlas es lo que hacia que pareciera ausente. Ahora esta donde se consulta.
--
-- Y la POSOLOGIA no es adorno: la tarjeta de nutraceuticos arma "15 g · linea polvo" con `serving_size` y
-- `presentation`, y sin ellos muestra el producto sin decir como se toma.
--
-- REGLA 0: esto es PORTAR, no construir. Cada valor sale de su archivo y ninguno lo inventamos nosotros.
--
-- ── LO QUE SIGUE SIN CONSTAR, Y SE DICE EN VEZ DE RELLENARLO ────────────────────────────────────
--
-- SU ARCHIVO DA EL NUMERO DEL REGISTRO Y EL FABRICANTE, NO EL TITULAR DEL REGISTRO. Y son tres partes
-- distintas, que es justo lo que el bloqueante pedia separar:
--
--   · FABRICANTE (maquilador): Laboratorio Naturex S.A.S.
--   · TITULAR DE MARCA:        Centro de Nutricion Integral Katherine Ruiz S.A.S. (ya cargado, §7.7)
--   · TITULAR DEL REGISTRO:    NO CONSTA
--
-- Si el registro esta a nombre de Naturex y no de la proveedora, entonces la proveedora revende producto
-- registrado por otro, y eso cambia quien responde. Por eso el fabricante se anota en las notas del
-- proveedor (que es donde vive la relacion proveedor-maquilador) y el titular del registro se queda en
-- blanco: un nulo se ve, un supuesto plausible se da por bueno.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

UPDATE "nutraceuticals"
   SET "sanitary_registration" = 'RSA-0019736-2022',
       -- Su `descripcion` es la lista de ingredientes, que es lo que nuestro campo `composition` guarda.
       "composition" = 'Mezcla en polvo para bebida a base de arroz con avena, linaza, psyllium y probióticos.',
       "presentation" = 'polvo',
       "serving_size" = '15 g',
       -- Sin el "(gluten)": lo retiro el de su propio archivo el 11 de septiembre.
       "description" = 'Mezcla en polvo para bebida. Producto de tercero. Contiene avena.'
 WHERE "name" = 'LUVIA';--> statement-breakpoint

UPDATE "suppliers"
   SET "notes" = 'Proveedor de LUVIA en consignación. Perfil tributario PENDIENTE: sin él no se puede decidir si CNV le practica retención (§7.3). Conflicto de interés declarado (§7.9): la proveedora es también Integrante de la red. FABRICANTE del producto: Laboratorio Naturex S.A.S. (código 7232), según la ficha de Dirección Científica. TITULAR DEL REGISTRO SANITARIO RSA-0019736-2022: NO CONSTA; si está a nombre de Naturex y no de la proveedora, cambia quién responde frente al consumidor.'
 WHERE "name" = 'Centro de Nutrición Integral Katherine Ruiz S.A.S.';
