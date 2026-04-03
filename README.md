# Habioo - Plataforma de gestion de condominios

Documento tecnico y funcional del estado actual del sistema.

- Ultima actualizacion: 2026-04-02
- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express + PostgreSQL

---

## 1) Stack y arquitectura

- Frontend SPA con React Router.
- Backend REST con Express.
- Autenticacion JWT (`/login`, `/me`).
- Persistencia en PostgreSQL.
- Manejo de archivos para gastos y alquileres en `/uploads`.

---

## 2) Rutas frontend activas

Fuente: `habioo-frontend/src/App.jsx`

### Publicas
- `/` -> Login
- `/login` -> Login
- `/registro-junta` -> RegistroJunta

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
- CRUD de cuentas bancarias (tipos: Transferencia, Pago Movil, Zelle, Efectivo BS, Efectivo USD, Efectivo).
- CRUD y configuracion de fondos (operativo, visibilidad, porcentaje, renombrar).
- Libro mayor por cuenta/fondo con filtros, orden, consolidacion y detalle.
- Registro de egresos manuales.
- Transferencias entre fondos.
- Pago a proveedores desde fondos.
- Rollback de pagos validados desde libro mayor.
- Rollback de ajustes bancarios (`movimientos_fondos/:id/rollback-ajuste`).
- Rollback de transferencias (`transferencias/:id/rollback`).
- Rollback de egresos manuales (`movimientos-fondos/:id/rollback-egreso-manual`).

### 3.3 Gestion de inmuebles
- CRUD de propiedades con carga masiva (Excel).
- CRUD de copropietarios y residentes por propiedad.
- Ajuste de saldo por inmueble.
- Estado de cuenta de propiedad (admin y propietario).
- Acciones por fila: Editar datos, Agregar Residente, Agregar Co-propietarios, Eliminar.

### 3.4 Modulos adicionales
- Proveedores (individual y lote).
- Zonas con reglas de bloqueo por historial contable; presentadas como "Areas / Sectores" en UI.
- Encuestas / cartas consulta (tipos: Si/No, Opcion Multiple, Respuesta Abierta).
  - Admin: crear, cerrar, ver resultados, editar, eliminar.
  - Propietario: votar, ver resultados.
- Alquileres de amenidades:
  - Admin: definir espacios, tabs Espacios / Solicitudes, aprobar/rechazar pagos.
  - Propietario: reservar, ver mis reservas, reportar pago.
- Notificaciones para propietario con estados: En aprobacion, Aprobado, Rechazado.
- Perfil del condominio (logos, mensajes de aviso, info legal).
- Perfil del propietario (info personal, cambio de contrasena).
- Dashboard admin: KPIs, graficos, alertas de pendientes, movimientos recientes.
- Widget de chat AI (`AIChatWidget`).

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
- Conciliacion por periodo/junta/estado.
- Notificaciones internas de vinculacion y pagos relacionados.
- Registro publico de nuevas juntas en `/registro-junta` (sin depender de soporte).

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
1. Configurar `.env` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
2. (Opcional) `ENABLE_TEST_SEEDER=true`.
3. Ejecutar servidor en `http://localhost:3000`.

### Frontend (`habioo-frontend`)
1. Ejecutar Vite en `http://localhost:5173`.
2. `API_BASE_URL`:
   - `VITE_API_BASE_URL` si existe.
   - `http://localhost:3000` en local.
   - `https://auth.habioo.cloud` en produccion.

### Nota de sesion
- Si cambias entre entornos y aparece `401`, limpiar `localStorage` y volver a iniciar sesion.

---

## 8) Estado del Plan Junta General (al 2026-04-02)

### Completado
- Sprint 1: base operativa, soporte, migracion legacy y jerarquia inicial.
- Sprint 1 (operativo): registro publico de juntas (`/registro-junta` + APIs de registro).
- Sprint 2: vinculacion por codigo, CRUD de miembros y validaciones de RIF.
- Sprint 3: distribucion General -> Individual con trazabilidad (`origen_*`) y miembros fantasma.
- Sprint 4: conciliacion, estado de cuenta General<->Individual, pagos a Junta General como proveedor.

### En progreso
- Sprint 5:
  - reglas 1:1 de editar/eliminar vinculo por historial de avisos (implementado),
  - endurecimiento de permisos jerarquicos en modulos de inmuebles (implementado en modulos clave),
  - auditoria de eventos criticos de vinculacion (implementado),
  - notificaciones internas ampliadas (implementado parcialmente; falta cierre total de cobertura).

### Pendiente
- Sprint 6 completo: pruebas unitarias, integracion, E2E, QA formal, manual operativo y plan de despliegue/rollback.

### Avance Sprint 6 (actual)
- Base de test unitario backend agregada en `habioo-auth/tests/juntaGeneral.unit.test.js` (script `npm test` en `habioo-auth`).
- Test de integracion API agregados en `habioo-auth/tests/api.integration.test.js` (flujos de permisos y resumen Junta General).
- Test E2E frontend agregados con Playwright en `tests/e2e/junta-general.spec.ts` (script `npm run e2e`).
- Manual operativo: `../docs/junta-general/MANUAL_OPERATIVO_JUNTA_GENERAL.md`.
- Plan despliegue/rollback: `../docs/junta-general/DESPLIEGUE_Y_ROLLBACK_JUNTA_GENERAL.md`.
- Checklist QA formal: `../docs/junta-general/QA_CHECKLIST_STAGING.md` (pendiente corrida completa en staging).
