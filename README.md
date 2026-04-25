# Habioo - Plataforma de gestion de condominios

Documento tecnico y funcional del estado actual del sistema.

- Ultima actualizacion: 2026-04-25
- Frontend: React 19 + Vite 7 + Tailwind CSS 4 + TypeScript (mixto)
- Backend: Node.js + Express + PostgreSQL
- **Nuevo**: Rate limit distribuido en login con Redis (backend `habioo-auth/routes/auth.ts`)
- **Nuevo**: Tipografía global unificada para valores numéricos/monetarios via `@layer base` en CSS
- **Nuevo**: Escala tipográfica consistente basada en `rem` con variables CSS (`--font-size-xs` a `--font-size-4xl`)
- **Nuevo**: Normalización de tamaños de fuente en vistas (CuentasPorCobrar, Bancos, etc.)
- **Nuevo**: Mejoras de responsive design en cuentas bancarias y cuentas por cobrar

---

## 1) Stack y arquitectura

- Frontend SPA con React Router v7.
- Backend REST con Express.
- Autenticacion JWT (`/login`, `/me`) con refresh token via headers.
- Persistencia en PostgreSQL.
- Seguridad de login con rate limiting distribuido en Redis (POST /login).
- Manejo de archivos para gastos y alquileres en `/uploads`.
- **React 19.2.0** (actualizado desde versiones anteriores).
- **Tailwind CSS v4.2.1** con plugin nativo de Vite (sin PostCSS).
- **Vite 7.3.1** (actualizado).
- **TypeScript 5.9.3** con `allowJs: true` (codigo mixto JS/TS).
- Editor de texto enriquecido con **Lexical** (`@lexical/*` v0.41.0).
- Visualizacion de datos con **Recharts 3.8.0**.
- Renderizado de Markdown con **react-markdown** (chat AI).
- Iconos con **lucide-react** (v0.577.0).
- Integracion con **Google OAuth** (`@react-oauth/google`) - instalado.
- **MCP Server** (Model Context Protocol) integrado.
- Tablas reutilizables con componente `DataTable` con sorting, pagination.
- Date Pickers con `react-day-picker`.
- Componentes UI reutilizables: modales, tooltips, badges, loaders, headers.

---

## 2) Rutas frontend activas

Fuente: `habioo-frontend/src/App.jsx`

### Publicas
- `/` -> Redirige a `/login`
- `/login` -> Login
- `/cambio-clave-obligatorio` -> CambioClaveObligatorio (cambio de contraseÃ±a forzado)
- `/registro-junta` -> RegistroJunta
- `/error-403` -> Error403
- `/error-500` -> Error500
- `/error-503` -> Error503
- `*` -> NotFound (404)

### Junta (admin)
- `/dashboard` -> DashboardHome
- `/junta-general` -> JuntaGeneral
- `/perfil` -> PerfilCondominio
- `/proveedores` -> Proveedores
- `/gastos` -> Gastos
- `/cierres` -> Cierres
- `/inmuebles` -> Propiedades
- `/cuentas-cobrar` -> CuentasPorCobrar
- `/bancos` -> Bancos
- `/estado-cuentas` -> EstadoCuentasBancarias
- `/zonas` -> Zonas
- `/alquileres` -> VistaAlquileres
- `/carta-consulta` -> EncuestasAdmin
- `/avisos-cobro` -> HistorialAvisos
- `/aviso-cobro/:id` -> VistaAvisoCobro
- `/soporte/condominios` -> SoporteSuperUsuario (acceso directo)

**Modo Soporte**: Todas las rutas admin tienen espejo en `/soporte/:condominioId/*` para acceso de soporte multi-tab y deep links.

### Propietario / residente
- `/propietario/gastos` -> GastosPropietario (solo lectura)
- `/propietario/recibos` -> RecibosPropietario
- `/propietario/estado-cuenta` -> EstadoCuentaPropietario (tesoreria)
- `/propietario/estado-cuenta-inmueble` -> EstadoCuentaInmueblePropietario
- `/propietario/alquileres` -> AlquileresPropietario
- `/propietario/perfil` -> PerfilPropietario
- `/propietario/notificaciones` -> NotificacionesPropietario
- `/mis-cartas-consulta` -> EncuestasPropietario

### SuperUsuario (soporte)
- `/soporte/condominios` -> SoporteSuperUsuario

---

## 3) Funcionalidades activas

### 3.0 Autenticacion y sesion
- Login con cedula/contrasena.
- `POST /login` con rate limit distribuido por IP (Redis):
  - ventana: 15 minutos
  - maximo: 5 intentos
  - excedido: `429` con JSON amigable
  - headers estandar de rate limit activos (`standardHeaders: true`)
- Implementacion tecnica en backend (`habioo-auth/routes/auth.ts`):
  - `redis` client (`createClient`) con `REDIS_URL`
  - `express-rate-limit`
  - `rate-limit-redis` (`RedisStore`)
- Modo degradado controlado:
  - si Redis no conecta, el backend no se cae y `/login` sigue respondiendo
  - se desactiva temporalmente el limiter distribuido y se registra warning en logs
- Cambio de clave obligatorio para primer acceso o cuando se requiere (`/cambio-clave-obligatorio`).
- JWT con refresh automatico via headers `x-habioo-refreshed-token`.
- Validacion de sesion al montar app via `/me`.
- Manejo de errores HTTP:
  - 401: evento `habioo:session-ended` y cierre de sesion.
  - 403/500/503: redireccion a paginas de error con request ID.
- Modo soporte con backup de credenciales en `habioo_super_*_backup`.
- Sesion con debounce de 1500ms en botones/formularios sensibles.
### 3.1 Contabilidad y cobranza
- Registro de gastos (comun, zona, individual, extra) con soportes.
- Tabs de gastos: Todos, Comunes, Por Areas/Sectores, Individuales, Extra.
- Acciones por gasto: Ver Detalles, Editar, Pagar Proveedor, Ver Pagos, Eliminar.
- Preliminar y cierre de ciclo para generar avisos/recibos.
- Historial de avisos con filtros de estado (Todos, Pagados, Abonado, Pendiente).
- Cuentas por cobrar por inmueble con tabs Deudores / Todos.
- Registro y validacion de pagos desde cuentas por cobrar.
- Estado de cuenta por inmueble con filtros, orden y saldo acumulado.
- Ajustes de saldo desde cobranza con dos modos:
  - `COMPLETO`: puede impactar cuenta bancaria/fondos o gasto extra.
  - `SOLO_INMUEBLE`: impacta solo el estado de cuenta del inmueble.
- Leyenda explicita de no impacto bancario en modal de ajuste desde estado de cuenta.

### 3.2 Tesoreria bancaria
- CRUD de cuentas bancarias con tipos: Transferencia, Pago Movil, Zelle, Efectivo BS, Efectivo USD, Efectivo.
- **Nuevo**: Campo de moneda (USD/Bs) en cuentas bancarias.
- **Nuevo**: Tarjetas de presentacion de cuenta bancaria con componente `BancoCard`.
- **Nuevo**: Modales separados y reutilizables para CRUD de bancos (`BancoFormModal`, `BancosModals`).
- CRUD y configuracion de fondos (operativo, visibilidad, porcentaje, renombrar).
- Libro mayor por cuenta/fondo con filtros, orden, consolidacion y detalle.
- **Nuevo**: Saldos iniciales y aperturas de cuenta en estado de cuenta bancario.
- **Nuevo**: Footer con calculo corregido en filtros de estado de cuenta bancario.
- Registro de egresos manuales.
- **Nuevo**: Registro de ingresos manuales (reutiliza modal de egreso con accion inversa).
- **Nuevo**: Boton de rollback para egresos manuales desde libro mayor.
- Transferencias entre fondos.
- **Nuevo**: Modal dedicado para transferencias interbancarias con combobox de fondo destino.
- Pago a proveedores desde fondos.
- **Nuevo**: Pago a proveedores habilitado desde gastos transito/extra.
- Rollback de pagos validados desde libro mayor.
- Rollback de ajustes bancarios (`movimientos_fondos/:id/rollback-ajuste`).
- Rollback de transferencias (`transferencias/:id/rollback`).
- Rollback de egresos manuales (`movimientos-fondos/:id/rollback-egreso-manual`).
- **Nuevo**: Exportacion a Excel de estados de cuenta bancarios.
- **Nuevo**: Filtro maximo 2 meses en descarga de Excel (o rango de fecha especifico).

### 3.3 Gestion de inmuebles
- CRUD de propiedades con carga masiva (Excel).
- CRUD de copropietarios y residentes por propiedad.
- Ajuste de saldo por inmueble con concepto detallado.
- **Nuevo**: Obligatorio referencia y cuenta destino para ajustes de estado de cuenta.
- Estado de cuenta de propiedad (admin y propietario).
- Acciones por fila: Editar datos, Agregar Residente, Agregar Co-propietarios, Eliminar.
- **Nuevo**: Servicios basicos incluidos en lista de proveedores para inmuebles.

### 3.4 Modulos adicionales
- Proveedores (individual y lote).
  - **Nuevo**: Entidad bancaria para proveedores (cuentas bancarias de proveedores).
  - **Nuevo**: Servicios basicos incluidos en catalogo de proveedores.
- Zonas con reglas de bloqueo por historial contable; presentadas como "Areas / Sectores" en UI.
- Encuestas / cartas consulta (tipos: Si/No, Opcion Multiple, Respuesta Abierta).
  - Admin: crear, cerrar, ver resultados, editar, eliminar.
  - Propietario: votar, ver resultados.
- Alquileres de amenidades:
  - Admin: definir espacios, tabs Espacios / Solicitudes, aprobar/rechazar pagos.
  - Propietario: reservar, ver mis reservas, reportar pago.
- Notificaciones para propietario con estados: En aprobacion, Aprobado, Rechazado.
- Perfil del condominio (logos, mensajes de aviso, info legal, **editor de texto enriquecido con Lexical**).
- Perfil del propietario (info personal, cambio de contrasena).
- Dashboard admin: KPIs, graficos (Recharts), alertas de pendientes, movimientos recientes, notificaciones internas.
- Widget de chat AI (`AIChatWidget`) con:
  - Integracion con n8n backend.
  - Soporte de Markdown para respuestas.
  - **Nuevo**: Carga masiva de pagos via Excel (`/chat/preview-carga-pagos`, `/chat/confirmar-carga-pagos`).
  - **Nuevo**: Modo date-picker activado por patron de respuesta de AI.
  - Historial de chat en localStorage.
  - **Nuevo**: Validacion de pagos previo a carga masiva.
- **Nuevo**: Pagos con carga masiva (`PagosCargaMasivaModal`) con resultados detallados.
- **Nuevo**: Notificaciones flotantes toast con polling (15s):
  - Propietario: cambios de estado de pagos (Validado/Rechazado/PendienteAprobacion).
  - Admin: nuevos pagos pendientes, solicitudes de alquiler, notificaciones de Junta General.
- **Nuevo**: Tema oscuro/claro con toggle (almacenado en `localStorage.theme`).
- **Nuevo**: Escala tipográfica consistente basada en `rem` con variables CSS globales.
- **Nuevo**: Normalización de tamaños de fuente en todas las vistas principales.
- **Nuevo**: Mejoras responsive en Bancos y Cuentas por Cobrar.

### 3.5 Soporte SuperUsuario
- Vista de todos los condominios registrados.
- Acceso como soporte a cualquier condominio mediante sesion controlada.
- Endpoints dedicados: `GET /support/condominios`, `POST /support/entrar`, `POST /support/salir`.

### 3.6 Junta General (flujo jerarquico)
- CRUD de juntas individuales vinculadas (fantasma/vinculada).
- Generacion de codigo de invitacion por miembro y aceptacion desde Junta Individual.
- Cierre de ciclo General -> Individual con distribucion por partes iguales o alicuota.
- Propagacion de cargo a Junta Individual como gasto de origen Junta General.
- Estado de cuenta General <-> Individual en USD/Bs.
- Conciliacion por periodo/junta/estado con badge `EstadoConciliacionBadge`.
- Notificaciones internas de vinculacion y pagos relacionados.
- Registro publico de nuevas juntas en `/registro-junta` (sin depender de soporte).
- **Nuevo**: Auditoria de eventos criticos con log visible en UI.
- **Nuevo**: Validaciones de RIF para miembros.
- **Nuevo**: Reglas 1:1 de editar/eliminar vinculo por historial de avisos implementadas.
- **Nuevo**: Endurecimiento de permisos jerarquicos en modulos de inmuebles.
- **Nuevo**: Dashboard con KPIs especificos para Junta General.

---

## 4) Reglas de negocio relevantes

- Multitenancy por condominio del usuario autenticado.
- Aviso/recibo generado en cierre es inmutable (snapshot historico en `recibos.snapshot_jsonb`).
- Ajustes tipo `SOLO_INMUEBLE` no crean movimientos bancarios.
- Visibilidad de fondos para propietarios controlada por `fondos.visible_propietarios`.
- Rollback de pago:
  - requiere pago en estado `Validado`.
  - bloqueado si el pago tiene `recibo_id` directo.
  - deshace efectos en movimientos, fondos y saldo segun trazabilidad.
  - **sin limite fijo de 48 horas en la logica actual**.
- Zonas con historial contable no permiten cambios estructurales de inmuebles.
- Fondos con movimientos no se eliminan sin cumplir validaciones.
- Junta General no puede ver ni gestionar detalle de inmuebles.
- Junta General opera `Zonas/Sectores` sobre juntas individuales (incluyendo fantasmas).
- Si una junta individual ya fue incluida en aviso de cobro de Junta General, su vinculo no puede editarse/eliminarse.
- Endpoints legacy de inmuebles para Junta General retornan 403.
- **Nuevo**: Gastos historicos con pagos y recaudaciones retroactivas soportados.
- **Nuevo**: Gastos con pago adelantado sin recaudacion soportados.
- **Nuevo**: Desvio de porciones de pago a gastos extras disponible.
- **Nuevo**: Truncado de valores Bs->USD en modales de pago para evitar diferencias visuales con backend.
- **Nuevo**: Bloqueo de cierre de modales de pago al hacer click fuera (previene perdida de datos).
- **Nuevo**: Doble cargo evitado en saldo al aprobar pago notificado por inmueble.
- **Nuevo**: Conceptos detallados obligatorios al crear ajustes en estado de cuenta de inmuebles.
- **Nuevo**: Sort/tablas activado en estados de cuenta bancarios.
- **Nuevo**: Animacion de loading global (`HabiooLoader`) en operaciones de carga.
- **Nuevo**: Tooltip en ventanas modales para mejor UX.
- **Nuevo**: Scroll interno optimizado en modales para pantallas de baja altura.
- **Nuevo**: Manejo de mojibake (codificacion de caracteres) en chat y avisos de cobro.
- **Nuevo**: Referencia de origen y banco de origen eliminados de flujos de pago.
- **Nuevo**: Fecha de operacion agregada a registros de cobranza.
- **Nuevo**: Label de pago pendiente por aprobar visible en cuentas por cobrar.
- **Nuevo**: Escala tipográfica consistente basada en `rem` con variables CSS globales.
- **Nuevo**: Cuentas bancarias principales con fondo verde Habioo y texto blanco.
- **Nuevo**: Botones de accion en группа (button groups) para móviles en vistas de cierre.

---

## 5) Backend: rutas principales por modulo

Fuente: `habioo-auth/index.ts` + `habioo-auth/routes/*`

### Root / Auth
- `GET /`
- `POST /register`
- `POST /login`
- `GET /me`
- `GET /condominios/juntas-generales-disponibles`
- `POST /condominios/registro`

### Perfil condominio (`/api/perfil`)
- `GET /api/perfil/`
- `PUT /api/perfil/`
- `PUT /api/perfil/password`
- `POST /api/perfil/upload/:tipo`
- `DELETE /api/perfil/upload/:tipo`

### Proveedores
- `GET /proveedores`
- `POST /proveedores`
- `POST /proveedores/lote`
- `PUT /proveedores/:id`
- `DELETE /proveedores/:id`

### Gastos y cierres
- `POST /gastos`
- `PUT /gastos/:id`
- `GET /gastos`
- `DELETE /gastos/:id`
- `GET /preliminar`
- `PUT /metodo-division`
- `POST /cerrar-ciclo`
- `GET /gastos-extras-procesados`

### Recibos
- `GET /recibos-historial`
- `GET /recibos/:id/aviso`

### Pagos
- `POST /pagos-admin`
- `POST /pagos-propietario`
- `GET /pagos/pendientes-aprobacion`
- `POST /pagos/:id/validar`
- `POST /pagos/:id/rechazar`
- `POST /pagos/:id/rollback`
- `GET /pagos-proveedores/gasto/:gasto_id/detalles`
- `POST /pagos-proveedores`

### Bancos / libro mayor
- `GET /bancos`
- `POST /bancos`
- `PUT /bancos/:id`
- `PUT /bancos/:id/predeterminada`
- `DELETE /bancos/:id`
- `GET /bancos-admin/:id/estado-cuenta`
- `POST /egresos-manuales`
- `POST /transferencias`
- `POST /transferencias/:id/rollback`
- `GET /gastos-pendientes-pago`
- `POST /movimientos-fondos/:id/rollback-ajuste`
- `POST /movimientos-fondos/:id/rollback-egreso-manual`

### Fondos
- `GET /fondos`
- `POST /fondos`
- `PUT /fondos/:id`
- `PUT /fondos/:id/operativo`
- `PUT /fondos/:id/visibilidad-propietarios`
- `DELETE /fondos/:id`

### Zonas
- `GET /zonas`
- `POST /zonas`
- `PUT /zonas/:id`
- `DELETE /zonas/:id`

### Propiedades
- `GET /propiedades-admin`
- `GET /propiedades-admin/propietarios-existentes`
- `GET /propiedades-admin/:id/copropietarios`
- `POST /propiedades-admin/:id/copropietarios`
- `PUT /propiedades-admin/:id/copropietarios/:linkId`
- `DELETE /propiedades-admin/:id/copropietarios/:linkId`
- `DELETE /propiedades-admin/eliminar-todos`
- `GET /propiedades-admin/:id/estado-cuenta`
- `POST /propiedades-admin/lote`
- `POST /propiedades-admin`
- `PUT /propiedades-admin/:id`
- `DELETE /propiedades-admin/:id`
- `POST /propiedades-admin/:id/ajustar-saldo`

### Dashboard
- `GET /mis-propiedades`
- `GET /mis-finanzas`
- `GET /admin-resumen`
- `GET /api/dashboard/admin-resumen`
- `GET /admin-graficos`
- `GET /admin-movimientos`
- `GET /cuentas-por-cobrar`
- `POST /dashboard-admin/seed-prueba`

### Encuestas
- `POST /encuestas`
- `GET /encuestas/:condominio_id`
- `POST /encuestas/:id/votar`
- `GET /encuestas/:id/resultados`

### Alquileres
- `GET /alquileres`
- `POST /alquileres`
- `PUT /alquileres/:id`
- `PATCH /alquileres/:id/estado`
- `GET /alquileres/reservaciones`
- `PUT /alquileres/reservaciones/:id/estado`
- `PUT /alquileres/reservaciones/:id/aprobar-pago`
- `GET /alquileres/mis-reservas`
- `POST /alquileres/reservaciones/:id/pagar`
- `POST /alquileres/reservar`

### Propietario (`/api/propietario`)
- `GET /api/propietario/mis-propiedades`
- `GET /api/propietario/gastos/:condominio_id`
- `GET /api/propietario/mis-recibos/:propiedad_id`
- `GET /api/propietario/estado-cuenta-inmueble/:propiedad_id`
- `GET /api/propietario/estado-cuenta/:condominio_id`
- `GET /api/propietario/cuentas/:condominio_id`
- `GET /api/propietario/fondos-principal/:condominio_id`
- `GET /api/propietario/fondos/:condominio_id`
- `GET /api/propietario/estado-cuenta-cortes/:condominio_id`
- `GET /api/propietario/cuenta-principal/:condominio_id`
- `GET /api/propietario/notificaciones`
- `GET /api/propietario/perfil`
- `GET /api/propietario/perfil-relaciones`
- `PUT /api/propietario/perfil`
- `PUT /api/propietario/perfil/password`

### Soporte / SuperUsuario
- `GET /support/condominios`
- `GET /support/juntas-generales`
- `POST /support/condominios/crear`
- `POST /support/entrar`
- `POST /support/salir`

### Junta General
- `GET /juntas-generales/resumen`
- `GET /juntas-generales/miembros?include_inactivos=true`
- `POST /juntas-generales/miembros`
- `PUT /juntas-generales/miembros/:id`
- `DELETE /juntas-generales/miembros/:id`
- `POST /juntas-generales/miembros/:id/invitacion`
- `POST /juntas-generales/aceptar-invitacion`
- `GET /juntas-generales/conciliacion`
- `GET /juntas-generales/notificaciones`
- `POST /juntas-generales/notificaciones/:id/leida`

### Chat
- `POST /chat/ask`

---

## 6) Modelo de datos (resumen)

- `users`, `condominios`
- `propiedades`, `usuarios_propiedades`, `historial_saldos_inmuebles`
- `zonas`, `propiedades_zonas`
- `proveedores`
- `gastos`, `gastos_cuotas`
- `recibos` (con `snapshot_jsonb`), `pagos`
- `cuentas_bancarias`, `fondos`, `movimientos_fondos`
- `cortes_estado_cuenta_fondos` (snapshots mensuales por aviso)
- `junta_general_miembros`
- `junta_general_avisos`, `junta_general_aviso_detalles`
- `junta_general_notificaciones`
- `junta_general_auditoria_eventos`
- tablas de encuestas y respuestas
- tablas de alquileres y reservaciones

---

## 7) Ejecucion local

### Backend (`habioo-auth`)
1. Configurar `.env` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `REDIS_URL`.
2. (Opcional) `ENABLE_TEST_SEEDER=true`.
3. Ejecutar servidor en `http://localhost:3000`.

#### Redis para seguridad de login
- Variable requerida para rate limit distribuido: `REDIS_URL`.
- Ejemplo local: `REDIS_URL=redis://default:TU_CLAVE@127.0.0.1:6379/0`.
- Ejemplo remoto: `REDIS_URL=redis://default:TU_CLAVE@HOST:6379/0`.
- Si Redis no esta disponible:
  - log esperado: `[auth-rate-limit] Redis connection failed...`
  - el backend continua en modo degradado (sin rate limit distribuido en login).

#### Verificacion tecnica del limiter
- Log esperado al iniciar: `[auth-rate-limit] Redis limiter enabled.`
- Con intentos invalidos consecutivos a `/login`:
  - intentos 1-5: `401`
  - intento 6 (misma ventana de 15 minutos): `429`
- Deben verse headers de rate limit en la respuesta (`RateLimit-*`).
### Frontend (`habioo-frontend`)
1. Ejecutar Vite en `http://localhost:5173`.
2. `API_BASE_URL`:
   - `VITE_API_BASE_URL` si existe (variable de entorno).
   - `http://localhost:3000` en local (default).
   - `https://auth.habioo.cloud` en produccion.
3. Comandos disponibles:
   - `npm run dev` - servidor de desarrollo Vite
   - `npm run build` - build de produccion
   - `npm run preview` - preview del build
   - `npm run start` - `serve -s dist -l 3000` (produccion)
   - `npm run lint` - ESLint
   - `npm run e2e` - Playwright tests (headless)
   - `npm run e2e:headed` - Playwright tests (headed)

### Nota de sesion
- Si cambias entre entornos y aparece `401`, limpiar `localStorage` y volver a iniciar sesion.
- Credenciales de soporte se respaldan en `habioo_super_*_backup` para modo switch.

### APIs externas
- Tasa BCV: `https://ve.dolarapi.com/v1/dolares/oficial` (usada en Cierres, CuentasPorCobrar).

### Utilidades de frontend
- `src/utils/currency.ts` - `formatMoney()`
- `src/utils/datetime.ts` - `toYmdVE()`, locale `es`
- `src/utils/validators.ts` - sanitizacion de cedula/RIF, telefono, email
- `src/utils/juntaGeneralAvisos.ts` - `metodoDivisionLabel()`

### Arquitectura de autenticacion
- Token JWT en `localStorage` como `habioo_token`.
- Datos de sesion en `localStorage` como `habioo_session`.
- Refresh token via headers `x-habioo-refreshed-token` (interceptado en `main.jsx`).
- Evento `habioo:session-ended` para HTTP 401.
- Redirecciones automaticas para HTTP 403/500/503 con request ID.
- Debounce de 1500ms en botones y formularios sensibles.

---

## 8) Estado del Plan Junta General (al 2026-04-14)

### Completado
- Sprint 1: base operativa, soporte, migracion legacy y jerarquia inicial.
- Sprint 1 (operativo): registro publico de juntas (`/registro-junta` + APIs de registro).
- Sprint 2: vinculacion por codigo, CRUD de miembros y validaciones de RIF.
- Sprint 3: distribucion General -> Individual con trazabilidad (`origen_*`) y miembros fantasma.
- Sprint 4: conciliacion, estado de cuenta General<->Individual, pagos a Junta General como proveedor.
- Sprint 5: reglas 1:1 de editar/eliminar vinculo por historial de avisos, endurecimiento de permisos jerarquicos, auditoria de eventos criticos, notificaciones internas ampliadas.

### Completado - Sprint 6
- **Tests unitarios backend**: `habioo-auth/tests/juntaGeneral.unit.test.js` (script `npm test` en `habioo-auth`).
- **Tests de integracion API**: `habioo-auth/tests/api.integration.test.js` (flujos de permisos y resumen Junta General).
- **Tests E2E frontend**: Playwright en `tests/e2e/junta-general.spec.ts` (script `npm run e2e`).
- **Manual operativo**: `../docs/junta-general/MANUAL_OPERATIVO_JUNTA_GENERAL.md`.
- **Plan despliegue/rollback**: `../docs/junta-general/DESPLIEGUE_Y_ROLLBACK_JUNTA_GENERAL.md`.
- **Checklist QA formal**: `../docs/junta-general/QA_CHECKLIST_STAGING.md` (pendiente corrida completa en staging).

### En progreso
- Validacion completa de tests E2E en entorno de staging.
- corrida completa del checklist QA formal.



