# Habioo - README para asistencia (README-BOT)

Guia operativa para asistentes IA y soporte funcional.

- Ultima actualizacion: 2026-04-02
- Objetivo: orientar acciones segun rol, modulos y restricciones reales del sistema.

---

## 1) Contexto rapido

Habioo es una plataforma de gestion de condominios con dos vistas principales:
- Junta (admin): operacion contable y administrativa completa.
- Propietario/residente: consulta, pagos, reservas y notificaciones de su alcance.

---

## 2) Rutas frontend clave

### Junta
- `/dashboard`
- `/junta-general`
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

### Publicas
- `/login`
- `/registro-junta`

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
- Revertir pagos validados, ajustes bancarios, transferencias y egresos manuales.
- Gestionar encuestas y alquileres.
- Aprobar/rechazar reservas y pagos de alquiler de propietarios.

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

- `Dashboard` (`/dashboard`):
  - Solo lectura: KPIs, graficos, alertas de pendientes, movimientos recientes.

- `Gastos` (`/gastos`):
  - Crear: boton superior derecho `+ Nuevo Gasto`.
  - Filtrar por tipo: tabs `Todos`, `Comunes`, `Por Areas/Sectores`, `Individuales`, `Extra`.
  - Ver detalle: menu de acciones por fila -> `Ver Detalles`.
  - Editar: menu de acciones por fila -> `Editar`.
  - Pagar proveedor: menu de acciones por fila -> `Pagar Proveedor` (habilitado aunque el gasto aun no este en avisos de cobro).
  - Si el gasto aun no fue incluido en avisos, mostrar confirmacion previa indicando que afecta el estado de cuenta bancario seleccionado.
  - Ver pagos del gasto: menu de acciones por fila -> `Ver Pagos`.
  - Eliminar: menu de acciones por fila -> `Eliminar`.

- `Cierres` (`/cierres`):
  - Cierre mensual: boton principal `Cerrar Ciclo`.
  - Metodo de division: boton `Cambiar metodo de division`.

- `Avisos` (`/avisos-cobro`):
  - Filtrar: campos de rango de fecha, estado (Todos, Pagados, Abonado, Pendiente), busqueda.
  - Abrir aviso: boton de accion por fila (imprimir/ver).

- `Cuentas por Cobrar` (`/cuentas-cobrar`):
  - Tabs: `Deudores` (con saldo pendiente) / `Todos`.
  - Registrar pago: boton `Registrar Pago` en columna de acciones.
  - Estado de cuenta inmueble: boton `Ver Estado de Cuenta`.
  - Aprobar pagos pendientes: seccion de pendientes de aprobacion en la misma vista.

- `Estado de Cuentas` (`/estado-cuentas`):
  - Filtros: campos `Desde`, `Hasta`, `Buscar`, boton `Limpiar`.
  - Aumentar fuente tabla: boton `A+` al lado de `Limpiar`.
  - Reversion: columna `Acciones` -> boton `Revertir` en la fila del movimiento.
  - Movimientos reversibles desde esta vista: pagos validados, ajustes bancarios, pagos a proveedor, transferencias entre fondos y egresos bancarios/manuales (segun validaciones de trazabilidad).
  - Ver detalle: doble clic sobre una fila del libro mayor.

- `Bancos` (`/bancos`):
  - Nueva cuenta: boton `+ Nueva Cuenta Bancaria`.
  - Editar: menu `Opciones` por fila.
  - Eliminar: menu `Opciones` -> `Eliminar`.
  - Marcar predeterminada: menu `Opciones` -> `Hacer Principal`.
  - Ver fondos: accion por fila `Ver Fondos`.

- `Fondos` (modal desde Bancos):
  - Crear fondo: boton `+ Nuevo Fondo`.
  - Editar configuracion (nombre, operativo, visibilidad): acciones por fila dentro del modal.
  - Eliminar: accion `Eliminar` por fila (si aplica).

- `Inmuebles` (`/inmuebles`):
  - Crear: boton `+ Crear Inmueble`.
  - Carga masiva: boton `Carga Masiva` en cabecera.
  - Acciones por fila: `Editar datos`, `Agregar Residente`, `Agregar Co-propietarios`, `Eliminar`.

- `Zonas` (`/zonas`) — presentadas como "Areas / Sectores":
  - Crear: boton `+ Crear Area / Sector`.
  - Editar: icono lapiz por tarjeta.
  - Eliminar: icono basurero (si aplica).

- `Junta General` (`/junta-general`):
  - Registrar junta individual: bloque `Registrar Junta Individual`.
  - Estado de cuenta por junta: tabla `Estado de Cuenta por Junta`.
  - Conciliacion por periodo: filtro de mes, junta y estado.
  - Vinculacion de juntas: acciones `Editar`, `Codigo`, `Eliminar vinculo`.
  - Regla: si una junta ya tiene historial en aviso de cobro, queda bloqueada para editar o eliminar vinculo.

- `Alquileres` (`/alquileres`, Junta):
  - Tabs: `Espacios` / `Solicitudes`.
  - Crear amenidad: boton `+ Nuevo Alquiler` en tab Espacios.
  - Editar/activar: acciones por tarjeta de amenidad.
  - Solicitudes: aprobar o rechazar desde acciones de cada solicitud.

- `Alquileres` (`/propietario/alquileres`, Propietario):
  - Tabs: `Espacios` / `Ver Solicitudes`.
  - Reservar: boton `Reservar` en tarjeta de espacio.
  - Mis reservas: tab `Ver Solicitudes` con accion `Reportar pago`.

- `Encuestas`:
  - Junta (`/carta-consulta`): boton `+ Nueva Carta`. Acciones por encuesta: `Ver Resultados`, `Editar`, `Cerrar`, `Eliminar`.
  - Propietario (`/mis-cartas-consulta`): boton `Votar` (si no voto) / `Ver Resultados` (si ya voto o encuesta cerrada).

- `Proveedores` (`/proveedores`):
  - Crear: boton `+ Nuevo Proveedor`.
  - Carga masiva: boton `Carga Masiva`.
  - Acciones por fila: `Ver detalles`, `Editar datos`, `Eliminar`.

- `Perfil Condominio` (`/perfil`):
  - Editar informacion legal y de administrador.
  - Subir logos (principal, condominio, firma).
  - Configurar mensajes de avisos de cobro (4 mensajes).
  - Boton `Cambiar Contrasena`.

### 4.1 Registrar gasto (Junta)
1. Ir a `/gastos`.
2. Crear gasto (tipo, distribucion, monto BS, tasa, soportes).
3. Verificar que quede visible en listado y preliminar.
4. Si se requiere, se puede registrar pago a proveedor de inmediato (no depende de que exista aviso de cobro).

### 4.2 Cerrar ciclo y generar avisos (Junta)
1. Ir a `/cierres`.
2. Revisar preliminar del periodo.
3. Ejecutar `Cerrar Ciclo`.
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
1. `COMPLETO` (desde cuentas por cobrar):
   - `A favor` puede ir a cuenta bancaria o gasto extra.
   - Impacta contabilidad bancaria cuando corresponde.
2. `SOLO_INMUEBLE` (desde modal de estado de cuenta del inmueble):
   - Impacta solo estado de cuenta del inmueble.
   - No crea movimientos bancarios ni modifica fondos.

### 4.5 Reversiones (Junta)
1. Desde libro mayor (`/estado-cuentas`) usar boton `Revertir`.
2. Puede revertir:
   - pagos,
   - ajustes bancarios,
   - transferencias,
   - egresos manuales,
   - pagos a proveedor.
3. Requiere validaciones de trazabilidad y permisos.
4. No documentar limite fijo de 48h: la logica actual no aplica esa ventana.

### 4.8 Pagos a proveedores sin aviso generado (Junta)
1. En `/gastos`, usar `Pagar Proveedor` desde el menu de acciones.
2. El pago puede registrarse aunque el gasto no haya sido incluido aun en avisos de cobro.
3. Si el gasto no esta en avisos, debe mostrarse modal de confirmacion antes de procesar.
4. El impacto contable es inmediato en cuenta/fondo origen y en el estado de deuda del gasto.
5. El gasto sigue su ciclo normal para ser cobrado a copropietarios en el proximo cierre/aviso.

### 4.6 Alquileres
1. Junta gestiona catalogo en `/alquileres`.
2. Propietario reserva desde `/propietario/alquileres`.
3. Propietario reporta pago de reserva.
4. Junta aprueba/rechaza solicitud y pago.

### 4.7 Encuestas / carta consulta
1. Junta crea encuesta (`/carta-consulta`). Tipos: Si/No, Opcion Multiple, Respuesta Abierta.
2. Propietario responde (`/mis-cartas-consulta`).
3. Junta y propietario pueden consultar resultados segun permisos.

---

## 5) Restricciones funcionales importantes

- Datos aislados por condominio (multitenancy).
- Avisos de cobro generados en cierre son snapshots inmutables.
- Ajustes `SOLO_INMUEBLE` no deben afectar libro mayor ni fondos.
- Rollback de pago bloqueado si pago no esta `Validado` o si tiene recibo asociado.
- Zonas con historial contable no permiten cambios estructurales de inmuebles.
- Fondos con movimientos no se eliminan sin cumplir validaciones.
- Junta General no puede ver ni gestionar detalle de inmuebles.
- Junta General usa Zonas/Sectores sobre juntas individuales (incluyendo fantasmas), no sobre inmuebles.
- Junta General no puede acceder a endpoints legacy de inmuebles por URL/API directa (403).
- Registro operativo de juntas disponible en `/registro-junta`.

---

## 6) Endpoints de referencia para soporte

### Auth y perfil
- `POST /login`, `GET /me`
- `GET /condominios/juntas-generales-disponibles`
- `POST /condominios/registro`
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
- `POST /pagos-proveedores`
- `POST /pagos-proveedores/:id/rollback`

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
- Junta General:
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
- rutas frontend,
- reglas de rollback/ajuste,
- nuevos modulos visibles en menu.

---

## 9) Estado Junta General (al 2026-04-02)

### Completado
- Sprint 1: registro desde soporte, migracion legacy, jerarquia base y bloqueo de inmuebles para Junta General.
- Sprint 1 (extra): flujo operativo publico de registro en `/registro-junta`.
- Sprint 2: CRUD miembros, codigos de invitacion, aceptar invitacion, estados de vinculacion y validaciones de RIF.
- Sprint 3: cierre y distribucion General -> Individual con trazabilidad, miembros fantasma y UX de preliminar/cierre.
- Sprint 4: conciliacion, estado de cuenta General<->Individual, pagos a Junta General como proveedor y filtros.
- Sprint 5 (parcial): reglas 1:1 editar/eliminar por historial, endurecimiento de permisos jerarquicos, auditoria de vinculacion y notificaciones ampliadas.

### Pendiente
- Sprint 5: completar cobertura total de permisos/auditoria/notificaciones en todos los modulos.
- Sprint 6: pruebas automatizadas, QA formal, manual operativo y despliegue/rollback.

### Documentacion Sprint 6 disponible
- `../docs/junta-general/QA_CHECKLIST_STAGING.md`
- `../docs/junta-general/MANUAL_OPERATIVO_JUNTA_GENERAL.md`
- `../docs/junta-general/DESPLIEGUE_Y_ROLLBACK_JUNTA_GENERAL.md`

### Pruebas automatizadas Sprint 6 disponibles
- Backend unit: `habioo-auth/tests/juntaGeneral.unit.test.js`
- Backend integracion API: `habioo-auth/tests/api.integration.test.js`
- Frontend E2E (Playwright): `tests/e2e/junta-general.spec.ts`
