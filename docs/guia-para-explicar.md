# Guía para explicar Aularia

Documento de estudio. Cada sección responde a una pregunta que te pueden hacer,
con el archivo concreto donde está la respuesta por si te piden enseñarlo.

---

## 0. La frase de arranque

> Aularia es una plataforma SaaS multi-tenant de cursos online. Un solo programa
> y una sola base de datos sirven a varias empresas de clientes, cada una con su
> portal, su marca, sus cursos y sus alumnos, sin que ninguna pueda ver los datos
> de otra.

**Multi-tenant** = varios inquilinos ("tenants") compartiendo el mismo edificio.
Cada empresa es un inquilino. Lo difícil de esto no es que funcione: es que
**nadie pueda asomarse al piso del vecino**. De ahí que casi todo lo que viene
después hable de aislamiento.

**Stack**: Next.js 16 (React 19) + Supabase (PostgreSQL) + Stripe + Resend.
Desplegado en Vercel.

---

## 1. Supabase: dónde está cada cosa y para qué sirve

Supabase es **PostgreSQL con extras**: base de datos + sistema de usuarios
(Auth) + almacenamiento de archivos (Storage). En su panel, tres sitios:

| Dónde | Qué hay |
|---|---|
| **Table Editor** | Las tablas de datos |
| **Authentication → Users** | Las cuentas (correo y contraseña). Tabla `auth.users`, separada de las tuyas |
| **Storage** | Los archivos: vídeos e imágenes |

### Las tablas, agrupadas por para qué sirven

**Quién es quién**
- `profiles` — un perfil por cuenta (nombre, correo). Se crea **sola** con un
  *trigger* llamado `on_auth_user_created`: cada vez que aparece una fila en
  `auth.users`, Postgres inserta automáticamente la de `profiles`. Nadie tiene
  que acordarse de hacerlo desde el código.
- `organizations` — una fila por empresa cliente. Solo cosas públicas: nombre,
  slug (su dirección), logo, color, textos de la portada, curso destacado.

**Roles: quién puede qué**
- `organization_admins` — quién administra cada empresa (`owner` o `admin`).
- `organization_students` — el listado de alumnos de cada empresa.
- `profiles.is_super_admin` — el dueño de la plataforma (tú).

> **Idea clave que te van a preguntar:** el rol NO es una columna del usuario.
> La misma persona puede ser administradora de una empresa y alumna de otra.
> Por eso los roles viven en tablas de relación (usuario ↔ empresa), no en
> `profiles`.

**El contenido**
- `courses` → `sections` (capítulos) → `lessons` (lecciones). Cada curso
  pertenece a una empresa (`organization_id`).
- El contenido de una lección está en `lessons.blocks`, una columna **jsonb**
  (JSON dentro de Postgres): una lista de bloques de vídeo o de texto. Se usa
  jsonb en vez de más tablas porque el orden y la forma de los bloques cambian
  a menudo y no hace falta consultarlos por separado.

**El dinero**
- `purchases` — quién compró qué curso, por cuánto y por qué medio.
- `organization_billing` — la suscripción que cada empresa te paga a ti
  (20 €/mes). **Está separada de `organizations` a propósito**: `organizations`
  es de lectura pública (hace falta para pintar el portal), y si el estado de
  pago viviera ahí, cualquiera podría ver qué clientes tuyos están en números
  rojos.
- `organization_integrations` — **la tabla más sensible**: las claves de pago de
  cada cliente. La clave de Whop se guarda **cifrada**, nunca en claro.

**Seguridad y avisos**
- `invitations` — invitaciones. **Del token solo se guarda su hash**, nunca el
  token en sí (mismo criterio que una contraseña).
- `verification_codes` — códigos de 6 dígitos de 30 minutos. También solo el hash.
- `admin_emails` — los correos de prueba a los que se redirigen todos los emails
  mientras el envío real está apagado.
- `video_views` — el progreso: una fila = esa lección está completada.

📄 El esquema completo, columna a columna, está en [docs/database.md](database.md).

---

## 2. Privacidad: RLS, la parte importante

### El problema

Con una base de datos normal, si el programa tiene un fallo y se le olvida
filtrar por empresa, se filtran datos de todos. **Row Level Security (RLS)** de
Postgres mueve esa protección a la base de datos: aunque el código pregunte
"dame todos los cursos", Postgres solo devuelve los que esa persona puede ver.

> Analogía: en vez de confiar en que el camarero se acuerde de a qué mesa
> llevar cada plato, la cocina solo le deja salir con los platos de su mesa.

**RLS está activo en todas las tablas.** Las reglas se llaman *policies*.

### Cómo se decide "quién puede qué"

Hay cuatro funciones dentro de Postgres:

- `is_super_admin()` — ¿es el dueño de la plataforma?
- `is_org_admin(org_id)` — ¿administra esta empresa?
- `is_org_owner(org_id)` — ¿es el propietario de esta empresa?
- `is_org_student(org_id)` — ¿es alumno **activo** de esta empresa?

Son `security definer`, que significa que se ejecutan con permisos elevados para
poder comprobar cosas que quien pregunta no podría consultar por su cuenta.

**Lo elegante:** esas mismas funciones las usan las policies de la base de datos
**y** el código de la aplicación (`src/lib/auth/requireOrgAdmin.ts` las llama por
RPC). Así la regla de "quién es admin de qué" está escrita **una sola vez**.

### Dos capas, no una

Cada operación sensible se comprueba **dos veces**:

1. En el código, antes de hacer nada (`requireOrgAdmin()`).
2. En la base de datos, con la policy de RLS.

No es redundancia inútil: si mañana alguien se olvida del primer chequeo, el
segundo sigue ahí. Es **defensa en profundidad**.

### Tres ejemplos concretos que puedes contar

**a) El alumno expulsado.** Si echan a un alumno, su fila de `purchases` **no se
borra** (queda el historial de que pagó) pero su `organization_students.status`
pasa a `removed`. La policy de las lecciones exige *compra* **y** `is_org_student`
(que comprueba que siga activo). Resultado: pierde el acceso sin perder el
registro contable.

**b) La fuga que hubo y cómo se cerró.** La policy de `courses` deja leer
**cualquier** curso publicado de **cualquier** empresa — hace falta para que el
sitio público funcione. Eso significaba que entrando en
`/o/empresaA/cursos/<id-de-empresaB>` se veía el curso de B con el logo y los
colores de A. Se arregló en la página, comparando la empresa del curso con la de
la URL. **La moraleja: la RLS no lo resuelve todo sola; hay que saber qué deja
pasar a propósito.** → [src/app/cursos/[id]/page.tsx](../src/app/cursos/[id]/page.tsx)

**c) La tabla sin ninguna policy.** `verification_codes` tiene RLS activo y
**cero policies**. Eso no es un descuido: en Postgres, RLS activo sin policies
significa que **nadie** puede tocarla, salvo la clave de servicio. Un código de
verificación no debe poder leerlo ni su propio destinatario — solo se comprueba
en el servidor.

---

## 3. Los archivos: Storage

Bucket `lesson-media`, con dos carpetas y **dos niveles de protección distintos**:

| Carpeta | Qué hay | Acceso |
|---|---|---|
| `images/` | Imágenes de cursos, logos | **Público**: son decorativas |
| `videos/` | Los vídeos de las lecciones | **Privado, sin lectura pública** |

### Cómo se sirve un vídeo sin que se pueda robar

El bucket es privado, así que la URL del vídeo no existe públicamente. Cuando un
alumno abre una lección:

1. El servidor comprueba que ha comprado el curso y sigue activo.
2. **Solo entonces** genera una *URL firmada*: un enlace temporal con una firma
   criptográfica que caduca.
3. Esa URL va al navegador dentro del HTML.

Si alguien copia el enlace y lo pasa, **caduca**. Y sin comprar el curso, el
servidor nunca llega a generarlo. → [src/lib/storage/media.ts](../src/lib/storage/media.ts)

> El orden importa y está comentado en el código: primero se comprueba el
> acceso, después se firman las URLs. Nunca al revés.

**Hueco conocido, dilo tú antes de que te lo pregunten:** la ruta de los
archivos (`videos/uuid.mp4`) no incluye la empresa, así que a nivel de Storage no
hay aislamiento por cliente — hoy depende del código. Está documentado como
pendiente.

---

## 4. Servidor vs cliente: el corazón de la arquitectura

### La regla

> **Todo lo que toque datos o secretos pasa por el servidor. El navegador solo
> pinta.**

### Por qué

Todo lo que llega al navegador es visible: el usuario abre las herramientas de
desarrollo y lo lee. Si el navegador hiciera las consultas, tendría que llevar
credenciales, y quien las tuviera podría pedir lo que quisiera.

Además: **nunca te fíes de lo que manda el navegador.** Cualquiera puede editar
un formulario antes de enviarlo. Por eso todas las comprobaciones se repiten en
el servidor aunque la pantalla ya las hiciera.

### Cómo se distingue un archivo de servidor de uno de cliente

**Regla de oro: en Next.js, un archivo es de servidor por defecto.** Solo es de
cliente si lleva `"use client"` en la primera línea.

| Marca | Dónde se ejecuta | Para qué |
|---|---|---|
| *(nada)* | **Servidor** | Consultar datos, comprobar permisos |
| `"use client"` | **Navegador** | Cosas interactivas: escribir, pulsar |
| `"use server"` | **Servidor** | *Server actions*: funciones que el navegador puede pedir que se ejecuten en el servidor |

Compruébalo tú: casi ningún archivo de `src/app/**/page.tsx` lleva `"use client"`.
Los que sí lo llevan son los formularios (`LoginForm.tsx`, `RegisterForm.tsx`…),
porque necesitan reaccionar a lo que escribes.

### Los tres tipos de llamada al servidor

**1. Consultas al pintar la página** (Server Component). La página consulta la
base de datos en el servidor y manda **HTML ya montado**.

```
Navegador pide /o/ivanorganico
   → proxy.ts detecta la empresa
   → page.tsx consulta Supabase EN EL SERVIDOR
   → llega HTML terminado
```
El navegador nunca habla con Supabase. → [src/app/OrganizationLanding.tsx](../src/app/OrganizationLanding.tsx)

**2. Server actions** (`"use server"`). Una función que vive en el servidor y que
el formulario invoca. Next se encarga del envío por debajo: **no hay que escribir
ninguna API**. Todos los archivos `actions.ts` del proyecto son esto.

**3. Route handlers** (`route.ts`). URLs de verdad, para cuando quien llama no es
tu propia pantalla: los **webhooks** de Stripe y Whop, que son servidores
externos avisando de que ha pasado algo. → `src/app/api/webhooks/`

### Ejemplo completo que puedes contar de memoria: iniciar sesión

1. `src/app/login/page.tsx` — **servidor**. Prepara los enlaces y pinta.
2. `src/app/login/LoginForm.tsx` — **navegador** (`"use client"`). El formulario.
3. Al enviar, llama a `loginAction` de `src/app/login/actions.ts` — **`"use server"`**.
4. Esa función habla con Supabase **en el servidor**, con las cookies de sesión.
5. Si va bien, `redirect()`. Si no, devuelve `{ error }` y el formulario lo pinta.

**La contraseña nunca la maneja código del navegador**: viaja del formulario al
servidor y de ahí a Supabase.

### Las dos llaves de Supabase (pregunta típica)

| Llave | Dónde | Qué puede |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Puede ir al navegador | Nada por sí sola: **la RLS la limita** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor, jamás** al navegador | **Se salta toda la RLS** |

El prefijo `NEXT_PUBLIC_` es literalmente la marca de "esto acaba en el
navegador". Que la llave anónima pueda salir no es un descuido: sin RLS activa
sería un agujero enorme, con RLS activa no puede hacer nada que no le
corresponda.

La de servicio se usa solo donde **no hay usuario** que pueda tener permiso:
webhooks (llama Stripe, no una persona) o al crear una empresa (aún no existe
nadie que la administre). → `src/lib/supabase/admin.ts`

### Multi-tenant: cómo sabe la app qué empresa es

`src/proxy.ts` se ejecuta **antes** que cualquier página. Ve que la URL empieza
por `/o/ivanorganico`, guarda `ivanorganico` en una cabecera y reescribe la ruta
internamente. La página cree que le pidieron `/`; el navegador sigue viendo
`/o/ivanorganico`.

---

## 5. Los tests

Hay **dos tipos**, y saber la diferencia es media respuesta:

| | **Unit tests** | **Tests E2E** |
|---|---|---|
| Qué prueban | Una función suelta | La app entera desde el navegador |
| Con qué | `node --test` (viene con Node) | Playwright (Chrome de verdad) |
| Tardan | ~0,1 segundos | ~25 segundos |
| Necesitan | Nada | Servidor + base de datos |
| Cuándo | En cada push | En el servidor, tras el push |

### Correrlos

```bash
npm run test:unit    # 40 unit tests, instantáneo
npm run test:e2e     # 29 tests de navegador
npm test             # los dos
```

### Los 40 unit tests: 5 archivos, y por qué esos

Se prueban **funciones puras** (mismas entradas → mismas salidas, sin base de
datos). Son las que más barato sale probar y las que más caro sale equivocarse:

| Archivo | Qué protege |
|---|---|
| `src/lib/auth/safeNextPath.test.ts` | **Seguridad.** Que `?next=` no pueda mandar a otro dominio (*open redirect*) |
| `src/lib/crypto/encryption.test.ts` | **Seguridad.** Que las claves de pago se cifren y que un texto manipulado falle en vez de colar |
| `src/lib/organizations/slug.test.ts` | Que el nombre de una empresa dé una dirección válida, con acentos, eñes o signos |
| `src/lib/organizations/brandColor.test.ts` | Que el texto sobre el color de marca siempre se lea |
| `src/lib/courses/landingRules.test.ts` | La regla de los 4 cursos de la portada y cuándo sale el botón "Cursos" |

**Un test bueno tiene tres partes** (enséñalo abriendo cualquiera):

```ts
test("rechaza //evil.com, que el navegador trata como absoluta", () => {
  assert.equal(safeNextPath("//sitio-falso.com"), null);
});
```
Nombre que dice qué debe pasar → se ejecuta → se comprueba el resultado.

### Cómo leer un fallo

Cuando falla, la salida dice el **archivo y la línea**, qué esperaba y qué
recibió:

```
✖ rechaza //evil.com  (1.2ms)
  AssertionError: Expected values to be strictly equal:
  + actual - expected
  + '//sitio-falso.com'
  - null
      at src/lib/auth/safeNextPath.test.ts:28:10
```

Se lee así: **`actual`** es lo que devolvió tu código, **`expected`** lo que
debía devolver. Aquí devolvió la URL peligrosa en vez de `null` → el filtro está
roto. Y `safeNextPath.test.ts:28` es dónde mirar.

Para correr solo el que falla:
```bash
node --test src/lib/auth/safeNextPath.test.ts
```

En los E2E, además, Playwright guarda captura y traza en `test-results/`.

---

## 6. Git: push, pull y qué se ejecuta solo

### Los tres sitios donde vive tu código

```
   Working directory  ──git add──▶  Staging  ──git commit──▶  Repositorio local
   (tus archivos)                  (lo elegido)              (historial en .git)
                                                                     │
                                                                git push
                                                                     ▼
                                                            GitHub (remoto)
```

Que **commit y push son cosas distintas** es la confusión más común: `commit`
guarda en tu ordenador, `push` lo sube. Puedes hacer diez commits y un solo push.

### El ciclo normal

```bash
git pull            # 1. traer lo que hayan subido otros (o tú desde otro equipo)
# ... trabajas ...
git status          # 2. ver qué has tocado
git add .           # 3. marcar lo que va en el commit
git commit -m "..." # 4. guardar en tu ordenador
git push            # 5. subir a GitHub
```

**`git pull` primero, siempre.** Es `fetch` (traer) + `merge` (mezclar) en un
solo comando. Si alguien tocó lo mismo que tú, sale un **conflicto**: git marca
las zonas en disputa y tienes que elegir a mano qué se queda.

### Qué se ejecuta automáticamente y dónde

Aquí hay una distinción que te van a valorar si la aciertas:

**Al hacer `git push` — en tu ordenador (hook de pre-push):**
```
git push
  → .git/hooks/pre-push
      → npm run lint
      → npm run test:unit
  → si algo falla, EL PUSH SE CANCELA y no sube nada
```
Se instala con `npm run hooks:install`. Solo lint y unit tests, porque son 2
segundos. Para saltárselo en una emergencia: `git push --no-verify`.

> Los hooks viven en `.git/hooks/`, que **no se sube al repositorio**. Por eso
> hace falta el script: cada persona que clone tiene que instalarlos una vez.

**Después del push — en el servidor (GitHub Actions):**

`.github/workflows/ci.yml` se dispara con cada push a `main` y con cada pull
request. Dos trabajos:

1. **`test-and-build`** → instala, lint, **unit tests**, build.
2. **`e2e`** → solo si el anterior pasó: instala Chrome y corre los 29 tests de
   navegador. Guarda el informe como artefacto durante 7 días.

Se ve en GitHub → pestaña **Actions**. Verde = pasó, rojo = falló; pinchas y
tienes el log exacto.

> **Ojo con la pregunta trampa: `git pull` no ejecuta nada.** Un pull solo trae
> archivos a tu ordenador. Lo que dispara los tests es el **push** (y abrir una
> pull request). Si quieres comprobar lo que acabas de traer, lo corres tú:
> `npm test`.

### Por qué dos niveles

- El **hook** es tu red rápida: evita subir algo roto.
- El **CI** es la red de verdad: corre en una máquina limpia, con todo instalado
  de cero. Detecta el clásico "en mi ordenador funciona" — algo que tú tienes
  instalado y el resto del mundo no.

---

## 7. Chuleta de 60 segundos

- **Multi-tenant**: una app, varias empresas, aisladas entre sí.
- **RLS**: la base de datos filtra por usuario, no solo el código. Dos capas.
- **Nunca te fíes del navegador**: todo se revalida en el servidor.
- **Server Components** (por defecto) consultan datos; **`"use client"`** solo
  para lo interactivo; **server actions** son el puente.
- **Dos llaves**: la anónima puede salir al navegador porque la RLS la contiene;
  la de servicio se salta la RLS y jamás sale del servidor.
- **Vídeos**: bucket privado + URL firmada que caduca, generada solo tras
  comprobar la compra.
- **Secretos**: contraseñas, tokens de invitación y códigos se guardan
  **hasheados**; las claves de pago, **cifradas**.
- **Tests**: 40 unitarios (rápidos, funciones puras) + 29 E2E (navegador real).
- **Push** dispara el hook local y luego el CI. **Pull no dispara nada.**
