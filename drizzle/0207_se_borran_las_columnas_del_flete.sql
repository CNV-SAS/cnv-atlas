-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- SE BORRAN LAS COLUMNAS DEL FLETE (Santiago, 2026-10-06)
--
-- LA 0206 LAS CONSERVO CON UN ARGUMENTO, y el argumento resulto falso. Decia: una venta ANTERIOR al cambio
-- si cobro flete y si puede retractarse, y en esa CNV lo debe devolver; borrarlas haria que devolviera de
-- menos y el dato no se podria reconstruir.
--
-- ESE ARGUMENTO DEPENDIA DE UN HECHO QUE NO VERIFIQUE. Santiago lo pidio y corrio la consulta
-- (`scripts/HAY_ALGUNA_VENTA_REAL_CON_FLETE_2026-10-06.sql`) contra la nube. Resultado: CERO. Ninguna venta
-- cobro flete, ni real ni de prueba, y NO HAY NINGUN DOMICILIO REGISTRADO. Las columnas nunca se escribieron.
--
-- ASI QUE NO PROTEGEN NADA, y conservarlas tiene costo: dos columnas rotuladas "historicas" que nadie puede
-- borrar sin repetir esta averiguacion, y un candado que tiene que distinguir leerlas de escribirlas.
--
-- LA LECCION, QUE VALE MAS QUE LA MIGRACION: "no se borra porque podria haber datos" es una hipotesis, no una
-- razon. Se verifica antes de convertirla en una decision de esquema. Es la misma familia que los nueve
-- rangos de cordura del motor: una cifra conservada porque nadie comprobo de donde salia.
--
-- Y ES FORWARD-ONLY: no se edita la 0206, se escribe esta. La 0206 queda como rastro de lo que se creyo el
-- 2026-10-05 y de por que se corrigio al dia siguiente.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- LOS TRES CHECK QUE DEPENDEN DE ESAS COLUMNAS, explicitos. Postgres los tiraria solo al soltar la columna,
-- pero nombrarlos deja escrito que desaparecen: eran las defensas del flete (que solo existiera en un
-- domicilio, y que lo cobrado cubriera el costo) y sin columnas no hay nada que defender.
alter table transactions drop constraint if exists transactions_flete_solo_en_domicilio;
alter table transactions drop constraint if exists transactions_costo_solo_en_domicilio;
alter table transactions drop constraint if exists transactions_flete_cubre_el_costo;

alter table transactions drop column if exists shipping_fee;
alter table transactions drop column if exists shipping_cost;

-- LA CONFIGURACION DEL FLETE. `flete_margen` tiene NOT NULL con default, asi que soltarla es la unica forma
-- de que no quede un valor vivo que alguien lea algun dia.
alter table commercial_config drop column if exists flete_tarifa;
alter table commercial_config drop column if exists flete_margen;

-- EL COSTO SUGERIDO POR CIUDAD. La tabla SE QUEDA: cambio de oficio en la 0206 y ahora es el DIRECTORIO que
-- traduce una ciudad a su codigo DANE para el analisis de ICA, que es un impuesto sobre la venta del
-- PRODUCTO y no sobre el envio. Lo que se va es la columna del precio.
alter table delivery_cities drop column if exists costo_sugerido;

-- ── LO QUE NO SE TOCA, y conviene que quede dicho aqui ──────────────────────────────────────────────
--
-- `shipping_address`, `shipping_city`, `shipping_department`, `shipping_dane_code` y `shipping_phone` SE
-- QUEDAN: son el destino del envio, no su precio. El municipio lo pide el analisis de ICA y el telefono es
-- con quien se coordina la entrega.
--
-- Y el CHECK `transactions_domicilio_completo` se queda tal cual: un domicilio sigue necesitando direccion y
-- ciudad, porque sin ellas no se puede despachar.
