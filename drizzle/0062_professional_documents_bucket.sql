-- Bucket privado del RUT del integrante (documento de identidad tributaria: tiene documento, direccion,
-- actividad economica). Mismo diseno que patient-reports (0004): bucket PRIVADO, y TODO el acceso va
-- mediado por SERVICE ROLE en un route handler que valida pertenencia antes de firmar la URL. Sin policy
-- de authenticated: ni subir ni leer directo desde el cliente. La ruta lleva el professional_id y el route
-- handler valida que sea el propio integrante o quien verifica; asi no queda accesible por adivinar la ruta.
-- on conflict do nothing: por si el bucket ya existe (creado desde Studio), la migracion no falla.

insert into storage.buckets (id, name, public)
values ('professional-documents', 'professional-documents', false)
on conflict (id) do nothing;
