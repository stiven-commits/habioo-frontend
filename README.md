# Habioo - Plataforma de gestion de condominios

Documento tecnico y funcional del estado actual del sistema.

- Ultima actualizacion: 2026-03-29
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

### Junta (admin)
- `/dashboard` -> DashboardHome
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

---

## 5) Backend: rutas principales por modulo

Fuente: `habioo-auth/index.ts` + `habioo-auth/routes/*`

### Root / Auth
- `GET /`
- `POST /register`
- `POST /login`
- `GET /me`

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
- `POST /support/entrar`
- `POST /support/salir`

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
