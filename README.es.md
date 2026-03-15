# Relay — Plataforma de API Gateway

<p align="center">
  <strong>API gateway autoalojado, motor de proxy y servidor de mocks — todo en uno.</strong><br/>
  Construido con NestJS · MongoDB · Vanilla JS · Sin servicios externos.
</p>

<p align="center">
  <a href="#-inicio-rápido">Inicio Rápido</a> ·
  <a href="#-características">Características</a> ·
  <a href="#-ejemplos-de-uso">Ejemplos de Uso</a> ·
  <a href="#-referencia-de-api">Referencia de API</a>
</p>

---

## ¿Qué es Relay?

Relay es un **API gateway autoalojado** que corre en tu propia infraestructura. Se ubica entre tus clientes y tus servicios backend, dándote:

- Un **motor de proxy** que reenvía peticiones a cualquier URL de backend — con inyección de headers, resolución de secrets y control de timeouts
- Un **servidor de mocks** para respuestas API instantáneas sin escribir código backend
- Una **capa de seguridad** con rate limiting, control de IPs, device fingerprinting, firma HMAC y detección de amenazas
- Un **dashboard para desarrolladores** para organizar, probar y auditar cada endpoint

> **¿Quién necesita Relay?** Freelancers que gestionan APIs de múltiples clientes, equipos pequeños que necesitan herramientas internas, desarrolladores frontend que necesitan servidores mock, y cualquiera que quiera visibilidad y control sobre sus APIs sin montar Kong, NGINX Plus o AWS API Gateway.

---

## Características

### Motor de Proxy Central
| Característica | Descripción |
|---|---|
| **Proxy Dinámico** | Reenvía GET/POST/PUT/PATCH/DELETE a cualquier URL backend |
| **Servidor de Mocks** | Devuelve JSON personalizado, códigos de estado, headers y delays |
| **Eventos Pre/Post** | Ejecuta scripts JavaScript o webhooks antes/después de cada llamada |
| **Validación de Parámetros** | Declara params obligatorios de query/body — validados antes de proxiar |
| **Manejo de Archivos** | Reenvía uploads multipart; sirve descargas de archivos binarios como mock |
| **Caché de Respuestas** | Caché TTL en memoria con desalojo LRU, configurable por endpoint |

### Módulo de Seguridad
| Característica | Descripción |
|---|---|
| **Rate Limiting** | Ventana deslizante por IP, API Key, device fingerprint o global |
| **Allowlist / Blocklist de IPs** | Soporte para notación CIDR, IP exacta y prefijo wildcard |
| **Device Fingerprinting** | SHA-256 de IP + User-Agent + headers Accept — funciona con cualquier cliente HTTP |
| **Detección de Amenazas** | Bloquea SQLi, XSS, Path Traversal, Command Injection, NoSQLi, SSTI |
| **Firma HMAC de Peticiones** | Verifica firmas (SHA-256/512) con comparación resistente a timing attacks |
| **CORS por Endpoint** | Sobreescribe la config global de CORS para endpoints individuales |
| **Límite de Tamaño de Body** | Rechaza peticiones sobredimensionadas antes de procesarlas |
| **Log de Auditoría** | Cada petición bloqueada queda registrada con IP, fingerprint y motivo |

### Herramientas para Desarrolladores
| Característica | Descripción |
|---|---|
| **Environments** | Conjuntos de variables con sintaxis `[[BASE_URL]]`, cambiables desde la barra de nav |
| **Vault de Secrets** | Valores cifrados con AES-256-GCM, resueltos como `{{NOMBRE_SECRET}}` en tiempo de proxy |
| **Colecciones** | Agrupa endpoints en carpetas; exporta por colección |
| **Import OpenAPI** | Crea endpoints en masa desde specs Swagger 2.x u OpenAPI 3.x |
| **Exportación Multi-Formato** | Postman v2.1, Insomnia v4, OpenAPI 3.0 YAML, scripts k6 |
| **Generación de Código** | 7 lenguajes: cURL, JS Fetch, Axios, jQuery, Python, k6, PHP |
| **Tester Integrado** | Envía peticiones con historial de 50 entradas, restaura llamadas anteriores |
| **Dashboard de Analíticas** | 8 KPIs, latencia p95/p99, tasa de errores, timeline de peticiones, drill-down |

---

## Inicio Rápido

### Requisitos
- **Node.js** 18 o superior
- **MongoDB** 6 o superior (instalación local o MongoDB Atlas tier gratuito)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/relay-api-platform.git
cd relay-api-platform
npm install
```

### 2. Configurar el entorno

```bash
cp .env.example .env
```

Edita `.env`:

```env
# Cadena de conexión a MongoDB
MONGODB_URI=mongodb://localhost:27017/relay

# Puerto del servidor (por defecto: 3000)
PORT=3000

# Clave hex de 64 caracteres para el cifrado AES-256-GCM del vault
# Genera una: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRET_ENCRYPTION_KEY=pega_tu_clave_hex_de_64_chars_aqui
```

**Usando MongoDB Atlas (tier gratuito):**
```env
MONGODB_URI=mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/relay?retryWrites=true&w=majority
```

### 3. Arrancar

```bash
# Modo desarrollo (hot-reload)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

Abre **http://localhost:3000** — el dashboard carga automáticamente.

---

## Ejemplos de Uso

### Ejemplo 1 — Ocultar una API key de terceros

**Situación:** Tu frontend necesita datos de clima pero no puedes exponer tu API key en las peticiones del navegador.

**Paso 1 — Guarda tu clave como Secret**
```
Dashboard → Secrets → Nuevo Secret
Nombre: WEATHER_KEY
Valor:  tu_api_key_de_openweathermap
```

**Paso 2 — Crea el endpoint**
```
Endpoints → Nuevo Endpoint
Nombre:       Obtener Clima
Método:       GET
Ruta Virtual: weather
Destino:      https://api.openweathermap.org/data/2.5/weather?appid={{WEATHER_KEY}}
```

**Paso 3 — Llámalo desde tu frontend**
```bash
curl "http://localhost:3000/api/weather?q=Mexico&units=metric"
```
El `{{WEATHER_KEY}}` se resuelve en el servidor. Tu clave real nunca llega al cliente.

---

### Ejemplo 2 — Mock API para desarrollo frontend

**Situación:** Tu equipo de frontend necesita trabajar antes de que el backend esté listo.

```
Endpoints → Nuevo Endpoint
Nombre:       Obtener Perfil de Usuario
Método:       GET
Ruta Virtual: usuarios/:id
Destino:      (dejar vacío — activa modo Mock)

Mock Response:
  Status: 200
  Delay:  150ms
  Body:
{
  "id": "usr_123",
  "nombre": "María García",
  "email": "maria@ejemplo.com",
  "rol": "admin"
}
```

Llama `GET http://localhost:3000/api/usuarios/cualquier-id` — devuelve tu mock al instante.

Cuando el backend real esté listo, solo agrega la URL de destino y el mock desaparece.

---

### Ejemplo 3 — Rate limiting para un endpoint público

**Situación:** Un endpoint está abierto al público y necesitas prevenir abuso. Permite 30 peticiones por minuto por IP. Bloquea infractores por 5 minutos.

```
Endpoints → Editar → Pestaña Security
☑ Habilitar Módulo de Seguridad

Rate Limit:
  ☑ Habilitado
  Peticiones Máx: 30
  Ventana:        60 segundos
  Estrategia:     Por dirección IP
  Duración bloqueo: 300 segundos
```

Respuesta al exceder el límite:
```http
HTTP 429 Too Many Requests
Retry-After: 300
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded: 30 requests per 60s"
}
```

---

### Ejemplo 4 — Despliegue multi-entorno

**Situación:** Misma estructura de API en dev, staging y producción, cada una en una URL base diferente.

**Crea tres environments:**
```
Environments → Nuevo Environment
  Nombre: Desarrollo    Variables: BASE_URL = http://localhost:8080
  Nombre: Staging       Variables: BASE_URL = https://staging.api.miempresa.com
  Nombre: Producción    Variables: BASE_URL = https://api.miempresa.com
```

**Configura tus endpoints:**
```
URL Destino: [[BASE_URL]]/v2/pedidos
```

Para cambiar de entorno, usa el selector en la barra de navegación. Todos los endpoints con `[[BASE_URL]]` se resuelven al nuevo valor en tiempo de proxy — sin editar ningún endpoint.

Puedes combinar variables de entorno y secrets:
```
URL Destino: [[BASE_URL]]/v2/usuarios?apiKey={{MI_SECRET}}
```

---

### Ejemplo 5 — Importar desde Swagger / OpenAPI

**Situación:** Tienes un spec existente y quieres crear todos los endpoints en Relay sin hacer clic en formularios.

```
Página de Environments → botón Importar Spec
```

Opción A — Pegar JSON:
```json
{
  "openapi": "3.0.0",
  "info": { "title": "Mi API", "version": "1.0.0" },
  "paths": {
    "/usuarios": {
      "get": { "summary": "Listar Usuarios", "tags": ["Usuarios"] }
    }
  }
}
```

Opción B — Desde URL:
```
https://petstore.swagger.io/v2/swagger.json
```

Resultado: Todos los endpoints creados, agrupados por tag en Colecciones, con mocks auto-poblados desde los ejemplos del spec.

---

### Ejemplo 6 — Verificar peticiones firmadas (HMAC)

**Situación:** Un microservicio interno llama a tu endpoint y quieres verificar que cada petición no ha sido manipulada.

```
Endpoints → Editar → Pestaña Security → HMAC Signing
☑ Habilitar HMAC Request Signing
Header:    X-Signature
Algoritmo: HMAC-SHA256
Secret:    (clic en Generar, luego Copiar snippet)
```

El botón de snippet te da código Node.js listo para pegar:

```js
const crypto  = require('crypto');
const SECRET  = 'tu_secret_compartido';
const METHOD  = 'POST';
const PATH    = '/pedidos';
const query   = {};
const body    = { item: 'widget', cantidad: 2 };

const payload = [METHOD, PATH,
  JSON.stringify(Object.keys(query).sort().reduce((a,k)=>(a[k]=query[k],a),{})),
  JSON.stringify(Object.keys(body).sort().reduce((a,k) =>(a[k]=body[k], a),{})),
].join('\n');

const firma = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
headers['X-Signature'] = firma;
```

Peticiones sin firma válida devuelven `401 HMAC_INVALID`.

---

### Ejemplo 7 — Script Pre-Evento para inyectar headers dinámicos

**Situación:** Un backend espera un header `Authorization: Bearer <token>` que cambia por petición.

```
Events → Nuevo Event
Nombre: Inyectar JWT
Tipo:   Script

Script:
  // ctx.secrets tiene los valores de tu vault
  // ctx.request.headers puede ser modificado
  ctx.request.headers['Authorization'] = `Bearer ${ctx.secrets.JWT_SECRET}`;
  ctx.extras.inyectadoEn = new Date().toISOString();
```

Adjunta este evento como **PRE** en cualquier endpoint que lo necesite.

---

### Ejemplo 8 — Exportar una colección para tu equipo

**Situación:** Construiste un conjunto de endpoints para un proyecto y quieres compartirlos como colección Postman.

```
Página de Endpoints → pasa el cursor sobre cualquier carpeta de Colección
→ clic en el ícono de Postman que aparece
```

O exporta todo el catálogo:
```
Página de Endpoints → menú Export
→ Export as Postman / Insomnia / OpenAPI / k6
```

---

## Referencia de API

URL Base: `http://localhost:3000`

### Motor de Proxy
| Método | Ruta | Descripción |
|---|---|---|
| `ANY` | `/api/:ruta` | Proxy dinámico — empareja por método + ruta virtual |

### Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/catalog/endpoints` | Listar todos (filtros: `?enabled=true&collection=foo`) |
| `POST` | `/catalog/endpoints` | Crear nuevo endpoint |
| `GET` | `/catalog/endpoints/stats` | Estadísticas agregadas |
| `GET` | `/catalog/endpoints/collections` | Nombres de colecciones únicas con conteos |
| `GET` | `/catalog/endpoints/:id` | Obtener uno por ID |
| `PUT` | `/catalog/endpoints/:id` | Actualizar (incluye securityConfig) |
| `DELETE` | `/catalog/endpoints/:id` | Eliminar |
| `POST` | `/catalog/endpoints/:id/generate-key` | Regenerar API key |
| `PUT` | `/catalog/endpoints/bulk/collection` | Mover múltiples a una colección |

### Executions (Historial)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/catalog/executions` | Historial reciente |
| `GET` | `/catalog/executions/stats` | Stats globales + timeline + p95/p99 |
| `GET` | `/catalog/executions/endpoint/:id` | Historial de un endpoint |
| `GET` | `/catalog/executions/endpoint/:id/stats` | Stats + percentiles + errores |
| `DELETE` | `/catalog/executions/bulk` | Eliminar en masa (body: `{ ids: [...] }`) |
| `DELETE` | `/catalog/executions/endpoint/:id` | Limpiar todo para un endpoint |

### Environments
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/catalog/environments` | Listar todos |
| `POST` | `/catalog/environments` | Crear |
| `GET` | `/catalog/environments/active` | Obtener el environment activo |
| `PUT` | `/catalog/environments/:id` | Actualizar nombre, variables, color |
| `DELETE` | `/catalog/environments/:id` | Eliminar |
| `POST` | `/catalog/environments/:id/activate` | Activar (desactiva todos los demás) |
| `POST` | `/catalog/environments/deactivate-all` | Desactivar todos |
| `POST` | `/catalog/environments/preview` | Vista previa de resolución `[[VAR]]` |

### Secrets
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/catalog/secrets` | Listar nombres (valores nunca se devuelven) |
| `POST` | `/catalog/secrets` | Crear |
| `PUT` | `/catalog/secrets/:id` | Actualizar |
| `DELETE` | `/catalog/secrets/:id` | Eliminar |
| `POST` | `/catalog/secrets/validate-refs` | Verificar si las `{{REFS}}` existen |

### Seguridad
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/catalog/security/events` | Eventos recientes (últimos 100, TTL 7 días) |
| `GET` | `/catalog/security/events/endpoint/:id` | Eventos de un endpoint |
| `GET` | `/catalog/security/stats` | Resumen 24h por tipo + IPs más activas |
| `GET` | `/catalog/security/rate-limits/:id` | Contadores RL activos de un endpoint |
| `POST` | `/catalog/security/unblock` | Desbloquear un identificador (IP/fingerprint) |
| `DELETE` | `/catalog/security/rate-limits/:id` | Limpiar contadores RL |

### Import
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/catalog/import/openapi` | Importar desde OpenAPI 3.x o Swagger 2.x |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     Cliente / Navegador                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Relay Gateway     │  :3000
                    │    (NestJS + SPA)    │
                    └──────────┬───────────┘
                               │
              ┌────────────────▼────────────────┐
              │        Pipeline de Proxy         │
              │  1.  Búsqueda de endpoint        │
              │  2.  Validación API Key          │
              │  2.5 Pipeline de seguridad       │
              │      · CORS · IP · Fingerprint   │
              │      · Amenazas · HMAC · RL      │
              │  3.  Lectura de caché            │
              │  3.5 Resolución [[VAR]] entorno  │
              │  4.  Resolución {{SECRET}}       │
              │  5.  Validación de parámetros    │
              │  6.  Eventos PRE                 │
              │  7.  Proxy / Mock                │
              │  8.  Eventos POST + Log          │
              │  9.  Escritura de caché          │
              └────────────────┬────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         Backend           Mock Response    Caché
         Destino              Server      en Memoria
                               │
                            MongoDB
                   (endpoints, events, executions,
                    secrets, environments, security)
```

### Stack Tecnológico
| Capa | Tecnología |
|---|---|
| Framework backend | NestJS 10 |
| Base de datos | MongoDB 6 + Mongoose 8 |
| Proxy HTTP | Axios |
| Manejo de archivos | Multer |
| Frontend | Vanilla JS + MaterializeCSS |
| Gráficas | Chart.js |
| Criptografía | Node.js built-in (`crypto`) |

---

## Estructura del Proyecto

```
src/
├── main.ts                      Punto de entrada — carga .env, inicia servidor
├── app.module.ts                Módulo raíz
└── modules/
    ├── proxy/                   ← Core: pipeline de proxy de 10 pasos
    ├── endpoints/               ← CRUD + schema + DTOs
    ├── events/                  ← Scripts Pre/Post + webhooks
    ├── executions/              ← Historial + stats + percentiles
    ├── cache/                   ← Caché TTL + LRU en memoria
    ├── secrets/                 ← Vault AES-256-GCM
    ├── security/                ← Rate limit + IP + fingerprint + HMAC
    ├── environments/            ← Conjuntos de variables por entorno
    ├── import/                  ← Importación masiva OpenAPI/Swagger
    └── settings/                ← Tema + preferencias de la app

src/public/
├── index.html                   Aplicación de página única (SPA)
└── js/app.js                    Toda la lógica frontend

docs/
├── index.html                   Sitio de documentación GitHub Pages
└── index.es.html                Versión en español
```

---

## Variables de Entorno

| Variable | Requerida | Defecto | Descripción |
|---|---|---|---|
| `MONGODB_URI` | ✅ Sí | `mongodb://localhost:27017/relay` | Cadena de conexión MongoDB |
| `PORT` | No | `3000` | Puerto del servidor HTTP |
| `SECRET_ENCRYPTION_KEY` | ✅ Sí* | — | Clave hex de 64 chars para AES-256-GCM |

*Requerida solo si usas el Vault de Secrets.

Genera una clave:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Notas de Seguridad

- Los secrets se almacenan **cifrados con AES-256-GCM**. El valor en texto plano nunca se devuelve tras la creación.
- `SECRET_ENCRYPTION_KEY` es la única clave de descifrado — guárdala con respaldo. Si se pierde, los secrets son irrecuperables.
- La verificación HMAC usa `timingSafeEqual` de Node.js — inmune a timing attacks.
- Los logs de eventos de seguridad guardan solo los **últimos 6 caracteres** de las API keys, nunca el valor completo.
- Los contadores de rate-limit son **en memoria** y se reinician al reiniciar el servidor. Para despliegues distribuidos, extiende `SecurityService` para usar Redis.
- El archivo `.env` está en `.gitignore` — nunca lo subas al repositorio.

---

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```bash
docker build -t relay-api .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/relay" \
  -e SECRET_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  relay-api
```

---

## Licencia

MIT — libre de usar, modificar y distribuir.
