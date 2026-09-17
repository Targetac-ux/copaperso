# CopaPerso — Puesta en marcha

Todo lo que hay que hacer una vez para que el proyecto arranque. Después de esto,
`npm run dev` y a trabajar.

---

## 1. Requisitos

- **Node 22** o superior (`node -v`).
- Una cuenta de **Supabase** y otra de **Vercel** (ambas gratis para empezar).
- Opcional para desarrollo con base local: Docker + la CLI de Supabase.

## 2. Crear el proyecto de Supabase

1. En [supabase.com](https://supabase.com) → **New project**.
2. Nombre `copaperso`, región **us-east-1** (o us-west-1), contraseña de base fuerte
   — guárdala en tu gestor de contraseñas, no se puede recuperar.
3. Repite el proceso con un segundo proyecto `copaperso-staging`. Nunca probamos
   migraciones contra el de producción.

### Aplicar el esquema

Desde el **SQL Editor** de Supabase, ejecuta **todos** los archivos de
`supabase/migrations/` en orden alfabético, que es el cronológico. Los cuatro
primeros levantan el esquema; los demás son cambios posteriores y hay que
aplicarlos igual:

```
20260909000001_schema.sql            tablas, enums y funciones
20260909000002_rls.sql               seguridad y vistas públicas
20260909000003_storage.sql           buckets de fotos
20260909000004_seed_dev.sql          periodo actual + costos de §13
…                                    el resto, por fecha
20260916000001_historico_importado.sql   columnas del histórico importado
```

**Si ya tenías el proyecto montado**, solo hacen falta las que no hayas
aplicado: son ficheros sueltos y ninguna repite lo que hace otra.

O con la CLI, que es lo recomendable en cuanto le pierdas el miedo:

```bash
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push
```

### Crear tu usuario de host

1. **Authentication → Users → Add user**: tu correo y una contraseña. Marca
   *Auto Confirm User*.
2. Copia el `id` que aparece en la lista y ejecuta en el SQL Editor:

```sql
insert into app_user (user_id, display_name, role)
values ('PEGA-AQUÍ-EL-UUID', 'Tu nombre', 'host');
```

Sin este paso puedes iniciar sesión pero el panel te rechazará: es la segunda
puerta, a propósito.

### Desactivar el registro abierto

**Authentication → Providers → Email → Allow new users to sign up: OFF.**
En CopaPerso no hay registro público; los hosts se dan de alta a mano.

## 3. Variables de entorno

Copia `.env.example` a `.env` y rellena con **Project Settings → API Keys**:

| Variable | De dónde sale | Quién la ve |
|---|---|---|
| `SUPABASE_URL` | Project URL | Todos |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (antes *anon*) | El navegador |
| `SUPABASE_SECRET_KEY` | Secret key (antes *service_role*) | **Solo el servidor** |
| `NUXT_PUBLIC_SITE_URL` | La URL del sitio | Todos |

> La llave secreta se salta el RLS: con ella se puede leer y escribir todo.
> Nunca la pegues en el navegador, en el código del cliente ni en un commit.
> `.env` ya está en `.gitignore`.

## 4. Arrancar

```bash
npm install
npm run dev
```

- Sitio público: <http://localhost:3000>
- Panel del host: <http://localhost:3000/host>

## 5. Comprobar que todo está bien

```bash
npm run lint        # estilo
npm run typecheck   # tipos
npm test            # unitarios
npm run build       # compilación de producción
```

Y las pruebas de punta a punta, que necesitan la app levantada:

```bash
npx playwright install chromium   # solo la primera vez
npm run test:e2e
```

Los tests que tocan la base necesitan las variables del `.env` y una cuenta de
host. Para no usar la tuya, hay un usuario de pruebas desechable:

```bash
set -a; . ./.env; set +a
node scripts/e2e-user.mjs create > /tmp/e2e.env   # imprime correo y contraseña
set -a; . /tmp/e2e.env; set +a
npm run test:e2e
node scripts/e2e-user.mjs destroy                 # bórralo siempre al terminar
```

**Bórralo siempre al acabar:** es una cuenta con acceso de host, y mientras
exista es una puerta abierta más.

## 6. Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project** e importa el repo. Detecta Nuxt solo.
3. En **Settings → Environment Variables**, las mismas cuatro variables del punto 3
   (las de producción, no las de staging).
4. Deploy. Cada push a `main` publica; cada PR genera una preview.

### Secretos del repositorio en GitHub

Para los workflows automáticos (**Settings → Secrets and variables → Actions**):

| Secreto | Para qué |
|---|---|
| `SITE_URL` | El ping semanal que evita que Supabase pause el proyecto |
| `SUPABASE_DB_URL` | El volcado semanal de seguridad |

## 7. Regenerar los tipos

Cada vez que cambie el esquema:

```bash
npm run db:types
```

Sobrescribe `shared/types/database.types.d.ts`, que ahora está escrito a mano
solo con las tablas de la Fase 1.

## 8. Cuando lleguen imágenes nuevas

Déjalas en `assets/` con el nombre que indica `docs/06-prompts-de-imagenes.md` y:

```bash
npm run assets
```

Regenera `public/` con los tamaños y formatos correctos, y te dice cuáles faltan.
