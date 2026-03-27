# Habioo - Plataforma de gestion de condominios

Documento tecnico y funcional del estado actual del sistema.

- Ultima actualizacion: 2026-03-27
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
- `/dashboard` -> Dashboard principal
- `/perfil` -> Perfil del condominio
- `/proveedores` -> Proveedores
- `/gastos` -> Gastos
- `/cierres` -> Cierres y avisos
- `/inmuebles` -> Propiedades
- `/cuentas-cobrar` -> Cuentas por cobrar
- `/bancos` -> Cuentas bancarias y fondos
- `/estado-cuentas` -> Libro mayor bancario
- `/zonas` -> Zonas / sectores
- `/alquileres` -> Gestion de alquileres de amenidades
- `/carta-consulta` -> Encuestas / cartas consulta
- `/avisos-cobro` -> Historial de avisos
- `/aviso-cobro/:id` -> Vista individual del aviso

### Propietario / residente
- `/propietario/gastos` -> Gastos del condominio (solo lectura)
- `/propietario/recibos` -> Recibos y pago
- `/propietario/estado-cuenta` -> Tesoreria (fondos y libro)
- `/propietario/estado-cuenta-inmueble` -> Estado de cuenta del inmueble
- `/propietario/alquileres` -> Alquiler de espacios y reservas
- `/propietario/perfil` -> Perfil propio
- `/propietario/notificaciones` -> Notificaciones
- `/mis-cartas-consulta` -> Encuestas del propietario

---

## 3) Funcionalidades activas

### 3.1 Contabilidad y cobranza
- Registro de gastos (comun, zona, individual, extra) con soportes.
- Preliminar y cierre de ciclo para generar avisos/recibos.
- Historial de avisos y vista imprimible.
- Cuentas por cobrar por inmueble con registro y validacion de pagos.
- Estado de cuenta por inmueble con filtros y saldo acumulado.
- Ajustes de saldo desde cobranza con dos modos:
  - `COMPLETO`: puede impactar cuenta bancaria/fondos o gasto extra.
  - `SOLO_INMUEBLE`: impacta solo el estado de cuenta del inmueble.
- Ajuste desde modal de estado de cuenta del inmueble con leyenda explicita de no impacto bancario.

### 3.2 Tesoreria bancaria
- CRUD de cuentas bancarias.
- CRUD y configuracion de fondos (operativo, visibilidad, porcentaje, renombrar).
- Libro mayor por cuenta/fondo con filtros, orden, consolidacion y detalle.
- Registro de egresos manuales.
- Transferencias entre fondos.
- Pago a proveedores desde fondos.
- Rollback de pagos validados desde libro mayor.
- Rollback de ajustes bancarios (`movimientos_fondos/:id/rollback-ajuste`).

### 3.3 Gestion de inmuebles
- CRUD de propiedades, copropietarios y residentes.
- Carga masiva de propiedades.
- Ajuste de saldo por inmueble.
- Estado de cuenta de propiedad (admin y propietario).

### 3.4 Modulos adicionales
- Proveedores (individual y lote).
- Zonas con reglas de bloqueo por historial contable.
- Encuestas / cartas consulta (crear, votar, ver resultados).
- Alquileres de amenidades:
  - Definir alquileres (admin).
  - Reservar (propietario).
  - Reportar pago de reserva.
  - Aprobar/rechazar solicitudes y pagos.
- Notificaciones para propietario.
- Perfil del condominio y perfil del propietario.

---

## 4) Reglas de negocio relevantes

- Multitenancy por condominio del usuario autenticado.
- Aviso/recibo generado en cierre es inmutable (snapshot historico).
- Ajustes tipo `SOLO_INMUEBLE` no crean movimientos bancarios.
- Visibilidad de fondos para propietarios controlada por `visible_propietarios`.
- Rollback de pago:
  - requiere pago en estado `Validado`.
  - bloqueado si el pago tiene `recibo_id` directo.
  - deshace efectos en movimientos, fondos y saldo segun trazabilidad.
  - **sin limite fijo de 48 horas en la logica actual**.

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

### Proveedores
- `GET /proveedores`
- `POST /proveedores`
- `POST /proveedores/lote`
- `PUT /proveedores/:id`
- `DELETE /proveedores/:id`

### Gastos y cierres
- `POST /gastos`
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
- `GET /gastos-pendientes-pago`
- `POST /movimientos-fondos/:id/rollback-ajuste`

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

### Chat
- `POST /chat/ask`

---

## 6) Modelo de datos (resumen)

- `users`, `condominios`
- `propiedades`, `usuarios_propiedades`, `historial_saldos_inmuebles`
- `zonas`, `propiedades_zonas`
- `proveedores`
- `gastos`, `gastos_cuotas`
- `recibos`
- `pagos`
- `cuentas_bancarias`, `fondos`, `movimientos_fondos`
- `cortes_estado_cuenta_fondos`
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
