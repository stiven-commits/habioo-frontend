# Habioo - README para asistencia (README-BOT)

Guia operativa para asistentes IA y soporte funcional.

- Ultima actualizacion: 2026-03-27
- Objetivo: orientar acciones segun rol, modulos y restricciones reales del sistema.

---

## 1) Contexto rapido

Habioo es una plataforma de gestion de condominios con dos vistas principales:
- Junta (admin): operacion contable y administrativa completa.
- Propietario/residente: consulta, pagos, reservas y notificaciones de su alcance.

Sistema web:
- Frontend: React + Vite.
- Backend: Express + PostgreSQL.

---

## 2) Rutas frontend clave

### Junta
- `/dashboard`
- `/perfil`
- `/proveedores`
- `/gastos`
- `/cierres`
- `/inmuebles`
- `/cuentas-cobrar`
- `/bancos`
- `/estado-cuentas`
- `/zonas`
- `/alquileres`
- `/carta-consulta`
- `/avisos-cobro`
- `/aviso-cobro/:id`

### Propietario
- `/propietario/gastos`
- `/propietario/recibos`
- `/propietario/estado-cuenta`
- `/propietario/estado-cuenta-inmueble`
- `/propietario/alquileres`
- `/propietario/perfil`
- `/propietario/notificaciones`
- `/mis-cartas-consulta`

---

## 3) Que puede hacer cada rol

### Junta
- Gestionar proveedores, gastos, cierres, avisos y cobranzas.
- Gestionar cuentas bancarias y fondos.
- Registrar y validar pagos.
- Aplicar ajustes de saldo por inmueble.
- Revertir pagos validados y ajustes bancarios (si la trazabilidad lo permite).
- Gestionar encuestas y alquileres.

### Propietario
- Ver gastos, recibos, estado de cuenta y notificaciones.
- Registrar pagos (quedan para validacion de junta).
- Ver y participar en encuestas.
- Reservar amenidades y reportar pago de reservaciones.
- Editar su perfil.

---

## 4) Flujos operativos recomendados

### 4.0 Mapa de botones y ubicacion en UI

Usar esta guia cuando el usuario pida "donde hago X". El agente debe mencionar ruta + boton exacto:

- `Gastos` (`/gastos`):
  - Crear: boton superior derecho `+ Nuevo Gasto`.
  - Ver detalle: doble clic sobre fila del gasto.
  - Eliminar: menu de acciones por fila -> `Eliminar`.
- `Cierres` (`/cierres`):
  - Cierre mensual: boton principal `Generar Aviso de Cobro`.
  - Metodo de division: boton `Cambiar metodo de division`.
- `Avisos` (`/avisos-cobro`):
  - Abrir aviso: boton de accion por fila (imprimir/ver).
- `Cuentas por Cobrar` (`/cuentas-cobrar`):
  - Menu por inmueble: boton `Opciones` en columna `Acciones`.
  - Registrar pago: `Opciones` -> `Registrar Pago`.
  - Estado de cuenta inmueble: `Opciones` -> `Estado de Cuenta`.
  - Ajuste completo (con posible impacto bancario): `Opciones` -> `Ajuste`.
  - Ajuste solo inmueble: dentro del modal `Estado de Cuenta`, boton `Ajuste`.
- `Estado de Cuentas` (`/estado-cuentas`):
  - Filtros: campos `Desde`, `Hasta`, `Buscar`, boton `Limpiar`.
  - Aumentar fuente tabla: boton `A+` al lado de `Limpiar`.
  - Reversion: columna `Acciones` -> boton `Revertir` en la fila del movimiento.
  - Ver detalle: doble clic sobre una fila del libro mayor.
- `Bancos` (`/bancos`):
  - Nueva cuenta: boton `+ Nueva Cuenta`.
  - Editar/Eliminar/Predeterminada: menu `Opciones` por fila.
  - Ver fondos: accion por fila `Ver fondos`.
- `Fondos` (modal desde Bancos):
  - Crear fondo: boton `+ Nuevo Fondo`.
  - Editar configuracion: acciones por fila dentro del modal.
  - Eliminar: accion `Eliminar` por fila (si pasa validaciones).
- `Inmuebles` (`/inmuebles`):
  - Crear: `+ Nueva Propiedad`.
  - Acciones por fila: menu `Opciones` -> editar / eliminar / estado de cuenta / ajuste.
  - Carga masiva: boton de carga de Excel en cabecera.
- `Zonas` (`/zonas`):
  - Crear: `+ Crear Area / Sector`.
  - Editar: icono lapiz por tarjeta.
  - Activar/Desactivar: switch/icono en tarjeta.
  - Eliminar: icono basurero (si aplica).
- `Alquileres` (`/alquileres`, Junta):
  - Crear amenidad: boton de crear alquiler (cabecera).
  - Editar/activar: acciones por tarjeta/fila de amenidad.
  - Solicitudes: aprobar o rechazar desde acciones de cada solicitud.
- `Alquileres` (`/propietario/alquileres`, Propietario):
  - Reservar: boton `Reservar` en tarjeta de espacio.
  - Mis reservas: pestana/listado con accion `Reportar pago`.
- `Encuestas`:
  - Junta (`/carta-consulta`): boton `Nueva carta consulta` o `Crear encuesta`.
  - Propietario (`/mis-cartas-consulta`): boton `Votar` / `Enviar respuesta`.

### 4.1 Registrar gasto (Junta)
1. Ir a `/gastos`.
2. Crear gasto (tipo, distribucion, monto BS, tasa, soportes).
3. Verificar que quede visible en listado y preliminar.

### 4.2 Cerrar ciclo y generar avisos (Junta)
1. Ir a `/cierres`.
2. Revisar preliminar del periodo.
3. Ejecutar `Generar Aviso de Cobro`.
4. Confirmar resultado en `/avisos-cobro`.

### 4.3 Registrar pago de propietario (Junta o Propietario)
1. Completar monto, referencia, fecha de pago, tasa y cuenta.
2. Pago entra como pendiente o se valida segun flujo.
3. Confirmar impacto en:
   - saldo del inmueble,
   - libro mayor bancario,
   - fondos.

### 4.4 Ajuste de saldo en cobranza (Junta)
Existen 2 modos:
1. `COMPLETO` (desde dropdown de cuentas por cobrar):
   - `A favor` puede ir a cuenta bancaria o gasto extra.
   - Impacta contabilidad bancaria cuando corresponde.
2. `SOLO_INMUEBLE` (desde modal de estado de cuenta del inmueble):
   - Impacta solo estado de cuenta del inmueble.
   - No crea movimientos bancarios ni modifica fondos.

### 4.5 Reversiones (Junta)
1. Desde libro mayor (`/estado-cuentas`) usar boton `Revertir`.
2. Puede revertir:
   - pagos (`/pagos/:id/rollback`),
   - ajustes bancarios (`/movimientos-fondos/:id/rollback-ajuste`).
3. Requiere validaciones de trazabilidad y permisos.
4. No documentar limite fijo de 48h: la logica actual no aplica esa ventana en el backend.

### 4.6 Alquileres
1. Junta gestiona catalogo en `/alquileres`.
2. Propietario reserva desde `/propietario/alquileres`.
3. Propietario reporta pago de reserva.
4. Junta aprueba/rechaza solicitud y pago.

### 4.7 Encuestas / carta consulta
1. Junta crea encuesta (`/carta-consulta`).
2. Propietario responde (`/mis-cartas-consulta`).
3. Junta y propietario pueden consultar resultados segun permisos.

---

## 5) Restricciones funcionales importantes

- Datos aislados por condominio (multitenancy).
- Avisos de cobro generados en cierre son snapshots inmutables.
- Ajustes `SOLO_INMUEBLE` no deben afectar libro mayor ni fondos.
- Rollback de pago bloqueado si pago no esta `Validado` o si tiene `recibo_id` directo.
- Zonas con historial contable no permiten cambios estructurales de inmuebles.
- Fondos con movimientos no se eliminan sin cumplir validaciones.

---

## 6) Endpoints de referencia para soporte

### Auth y perfil
- `POST /login`, `GET /me`
- `GET/PUT /api/perfil/`
- `PUT /api/perfil/password`

### Cobranza y pagos
- `GET /cuentas-por-cobrar`
- `POST /pagos-admin`
- `POST /pagos-propietario`
- `GET /pagos/pendientes-aprobacion`
- `POST /pagos/:id/validar`
- `POST /pagos/:id/rechazar`
- `POST /pagos/:id/rollback`

### Propiedades y estado de cuenta
- `GET /propiedades-admin`
- `GET /propiedades-admin/:id/estado-cuenta`
- `POST /propiedades-admin/:id/ajustar-saldo`
- `GET /api/propietario/estado-cuenta/:condominio_id`
- `GET /api/propietario/estado-cuenta-inmueble/:propiedad_id`

### Bancos y fondos
- `GET/POST/PUT/DELETE /bancos...`
- `GET /bancos-admin/:id/estado-cuenta`
- `POST /egresos-manuales`
- `POST /transferencias`
- `POST /movimientos-fondos/:id/rollback-ajuste`
- `GET/POST/PUT/DELETE /fondos...`

### Modulos adicionales
- Encuestas: `POST /encuestas`, `GET /encuestas/:condominio_id`, `POST /encuestas/:id/votar`, `GET /encuestas/:id/resultados`
- Alquileres: `GET/POST/PUT/PATCH /alquileres...`, `POST /alquileres/reservar`, `POST /alquileres/reservaciones/:id/pagar`, `PUT /alquileres/reservaciones/:id/aprobar-pago`
- Chat: `POST /chat/ask`

---

## 7) Checklist rapido de diagnostico

1. Verificar token y rol (`/me`).
2. Confirmar condominio y propiedad activa.
3. Revisar endpoint exacto y payload enviado.
4. Confirmar impacto esperado en:
   - estado de cuenta inmueble,
   - libro mayor,
   - fondos,
   - recibos.
5. Si hay inconsistencia visual, refrescar datos fuente despues de guardar (refetch).
6. Si hay texto corrupto (mojibake), revisar encoding UTF-8 de archivos.

---

## 8) Notas de mantenimiento documental

Actualizar este archivo cuando cambie cualquiera de estos puntos:
- rutas frontend en `src/App.jsx`,
- registro de rutas backend en `habioo-auth/index.ts`,
- reglas de rollback/ajuste,
- nuevos modulos visibles en menu.
