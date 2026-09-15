-- ============================================================================
-- Dar de alta a alguien en el panel de CopaPerso
--
-- Esto es el SEGUNDO paso. El primero es crear su cuenta en Supabase:
--
--   Authentication → Users → Add user → Create new user
--   · Email: el suyo
--   · Password: la que él quiera (se la pones tú y que la cambie, o le das
--     «Auto Generate»)
--   · Auto Confirm User: SÍ, marcado. Sin eso tiene que confirmar por correo
--     y si el proyecto no tiene SMTP configurado ese correo no llega nunca.
--
-- Tener cuenta en Supabase NO da acceso al panel: el servidor comprueba
-- además que esté en `app_user` (server/utils/guard.ts). Esta consulta es
-- la que le abre la puerta.
--
-- Cambia el correo y el nombre de las dos primeras líneas y ejecútala entera
-- en el SQL Editor.
-- ============================================================================

insert into app_user (user_id, display_name, role)
select
  u.id,
  'Madhusito',          -- ← el nombre que quieres que salga en el panel
  'host'                -- ← 'host' o 'moderator' (hoy hacen lo mismo, ver abajo)
from auth.users u
where u.email = 'correo-del-host@ejemplo.com'   -- ← el correo con el que lo creaste
on conflict (user_id) do update
  set display_name = excluded.display_name,
      role         = excluded.role;

-- Comprobar que quedó. Tienen que salir los dos.
select
  a.display_name,
  a.role,
  u.email,
  u.email_confirmed_at is not null as confirmado
from app_user a
join auth.users u on u.id = a.user_id
order by a.created_at;

-- ============================================================================
-- Notas
--
-- · Si la primera consulta dice «INSERT 0 0», es que no encontró ese correo en
--   auth.users: o está mal escrito, o la cuenta no llegó a crearse.
--
-- · **`host` y `moderator` hacen hoy exactamente lo mismo.** El rol solo cambia
--   la etiqueta de la barra lateral («Administrador» o «Moderador»); ningún
--   endpoint mira el rol. Está en el esquema por si algún día hace falta
--   separar permisos, pero hoy no separa nada.
--
-- · **El CCTM está pensado para una sola persona a la vez** (§7 de las
--   preguntas abiertas). Dos personas moviendo la misma copa en el mismo
--   momento no está previsto: no se rompe nada en la base, pero cada pantalla
--   verá el estado que cargó y la última acción en llegar es la que manda.
--
-- · Para quitarle el acceso más adelante, sin borrar su cuenta de Supabase:
--       delete from app_user where user_id = (
--         select id from auth.users where email = 'correo-del-host@ejemplo.com'
--       );
-- ============================================================================
