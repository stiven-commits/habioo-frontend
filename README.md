# Habioo - Plataforma de Gestion de Condominios

Documento de referencia funcional y tecnica del estado actual de la app.
Este README fusiona la base conceptual original con el inventario actualizado de modulos, endpoints y modelo de datos.

- Ultima actualizacion: 2026-03-17
- Stack: React + Vite + Tailwind (frontend), Node/Express + PostgreSQL (backend)

---

## 1) Stack tecnologico

- Frontend: React, Vite, React Router DOM, Tailwind CSS (dark/light).
- Backend: Express, `pg`, `jsonwebtoken`, `bcryptjs`, `multer`, `sharp`.
- Base de datos: PostgreSQL.
- Archivos de imagen: `uploads/gastos` (factura principal + soportes en webp).

---

## 2) Rutas frontend activas

Archivo de referencia: `habioo-frontend/src/App.jsx`

- `/` -> `Login`
- `/dashboard` -> `DashboardHome`
- `/perfil` -> `PerfilCondominio`
- `/proveedores` -> `Proveedores`
- `/gastos` -> `Gastos`
- `/cierres` -> `Cierres`
- `/inmuebles` -> `Propiedades`
- `/cuentas-cobrar` -> `CuentasPorCobrar`
- `/bancos` -> `Bancos`
- `/estado-cuentas` -> `EstadoCuentasBancarias`
- `/zonas` -> `Zonas`
- `/avisos-cobro` -> `HistorialAvisos`
- `/aviso-cobro/:id` -> `VistaAvisoCobro`

---

## 3) Estado funcional del frontend

### 3.1 Funcionalidades activas

1. Login y sesion JWT (`/login` + validacion `/me` en `Layout`).
2. Proveedores: listar/crear/editar/eliminar (borrado logico) por junta (aislados por condominio).
3. Gastos: crear con factura/soportes, listar (con filtros por tipo/fecha), eliminar (si cuotas pendientes).
4. Cierres: vista preliminar y cierre de ciclo.
5. Historial de avisos: filtros por texto/estado/fecha.
6. Bancos: listar, crear, eliminar, marcar predeterminada.
7. Fondos virtuales: listar, crear, eliminar por cuenta bancaria.
8. Zonas: listar, crear, editar, eliminar.
9. Propiedades: listar, crear, editar, ajustar saldo manual y carga masiva por Excel.
10. Dashboard residente: propiedades y resumen financiero.
11. Cuentas por cobrar (admin): tabla paginada de deuda, registrar pago y ver estado de cuenta por inmueble.
12. Libro Mayor / Estado de Cuentas Bancarias (admin): selector de cuenta, movimientos con saldo acumulado, pago a proveedores y transferencias entre fondos.
13. Sistema de avisos/confirmaciones UI: alertas del navegador migradas a modal centrada reutilizable en frontend (dark/light con contraste mejorado).
14. Vista de inmuebles (propietario): pantalla de estado de cuenta del edificio con vista diaria y vista por corte mensual por aviso.
15. Visibilidad de fondos para inmuebles: la junta define con check que fondos pueden ver los propietarios; la vista de propietario solo muestra fondos marcados como visibles.
16. Estados de cuenta por cortes (propietario): al emitir aviso de cobro se genera corte historico de fondos y el propietario puede filtrar por ano/mes.
17. Notificaciones de pago (propietario -> junta): los pagos enviados por propietarios quedan pendientes de aprobacion y la junta puede aprobar o rechazar con trazabilidad.

### 3.3 Novedades recientes (inmuebles y cobros)

1. Rediseño de la vista de estado de cuenta para inmuebles:
   - Tarjetas de resumen (Bs/USD) y boton para obtener BCV.
   - Vista dia a dia del saldo visible.
   - Tabla de egresos del fondo seleccionado.
2. Soporte de cortes mensuales por aviso de cobro:
   - Generacion de snapshot/corte por fondo al crear aviso.
   - Consulta historica por ano y mes para el propietario.
3. Flujo de pagos con aprobacion de junta:
   - El propietario registra/solicita pago.
   - La junta revisa pagos pendientes.
   - Aprobacion o rechazo con impacto en estado de cuenta y fondos.
4. Ajustes a Favor Inteligentes:
   - Ahora, al registrar un ajuste "A favor", es posible destinar el dinero a una cuenta bancaria, integrándose formalmente en los ingresos del Estado de Cuenta Bancario y sus fondos. 
   - También es posible asignar el ajuste positivo a un Gasto Extra procesado en específico, disminuyendo directamente la deuda del condominio para con ese concepto facturado.

### 3.2 Funcionalidades inactivas o parciales

1. Flujo visual de registro de usuario no expuesto en menu principal (aunque `POST /register` existe).
2. Funciones legacy fuera de rutas activas pueden existir en archivos historicos, pero no forman parte del circuito principal.

---

## 4) Backend: mapa unico de endpoints por archivo `.ts`

Archivo de composicion: `habioo-auth/index.ts`

### `routes/root.ts`
- `GET /`

### `routes/auth.ts`
- `POST /register`
- `POST /login`
- `GET /me`

### `routes/perfil.ts` (montado en `/api/perfil`)
- `GET /api/perfil/`
- `PUT /api/perfil/`
- `PUT /api/perfil/password`
- `POST /api/perfil/upload/:tipo`

### `routes/proveedores.ts`
- `GET /proveedores`
- `POST /proveedores`
- `POST /proveedores/lote`
- `PUT /proveedores/:id`
- `DELETE /proveedores/:id`

### `routes/gastos.ts`
- `POST /gastos`
- `GET /gastos`
- `DELETE /gastos/:id`
- `GET /preliminar`
- `PUT /metodo-division`
- `POST /cerrar-ciclo`

### `routes/recibos.ts`
- `GET /recibos-historial`
- `GET /recibos/:id/aviso`

### `routes/pagos.ts`
- `POST /pagos-admin`
- `POST /pagos-propietario`
- `GET /pagos/pendientes-aprobacion`
- `POST /pagos/:id/validar`
- `POST /pagos/:id/rechazar`
- `GET /pagos-proveedores/gasto/:gasto_id/detalles`
- `POST /pagos-proveedores`

### `routes/propietario.ts` (montado en `/api/propietario`)
- `GET /api/propietario/mis-propiedades`
- `GET /api/propietario/gastos/:condominio_id`
- `GET /api/propietario/mis-recibos/:propiedad_id`
- `GET /api/propietario/estado-cuenta/:condominio_id`
- `GET /api/propietario/cuentas/:condominio_id`
- `GET /api/propietario/fondos-principal/:condominio_id`
- `GET /api/propietario/fondos/:condominio_id`
- `GET /api/propietario/estado-cuenta-cortes/:condominio_id`
- `GET /api/propietario/cuenta-principal/:condominio_id`
- `GET /api/propietario/notificaciones`

### `routes/bancos.ts`
- `GET /bancos`
- `POST /bancos`
- `PUT /bancos/:id/predeterminada`
- `DELETE /bancos/:id`
- `GET /bancos-admin/:id/estado-cuenta`
- `POST /transferencias`
- `GET /gastos-pendientes-pago`

### `routes/fondos.ts`
- `GET /fondos`
- `POST /fondos`
- `DELETE /fondos/:id`

### `routes/zonas.ts`
- `GET /zonas`
- `POST /zonas`
- `PUT /zonas/:id`
- `DELETE /zonas/:id`

### `routes/propiedades.ts`
- `GET /propiedades-admin`
- `DELETE /propiedades-admin/eliminar-todos`
- `GET /propiedades-admin/:id/estado-cuenta`
- `POST /propiedades-admin/lote`
- `POST /propiedades-admin`
- `PUT /propiedades-admin/:id`
- `DELETE /propiedades-admin/:id` (solo sin avisos/recibos)
- `POST /propiedades-admin/:id/ajustar-saldo`

### `routes/dashboard.ts`
- `GET /mis-propiedades`
- `GET /mis-finanzas`
- `GET /cuentas-por-cobrar`
- `POST /dashboard-admin/seed-prueba`

---

## 5) Reglas funcionales clave

- Multitenancy: los datos se filtran por condominio del admin autenticado.
- Aviso inmutable: `recibos.snapshot_jsonb` congela el estado del aviso al momento de emision.
- Clasificacion de gastos: `Fijo` y `Variable`.
- Ajustes de inmueble: afectan solo estado de cuenta del inmueble (no cuentas bancarias/fondos).
- Visibilidad de fondos a propietarios: se controla por `fondos.visible_propietarios`.
- Cortes de estado de cuenta para propietarios: se almacenan en `cortes_estado_cuenta_fondos` y se consultan por periodo.
- Pagos de propietario: entran a cola de aprobacion (`PendienteAprobacion`) antes de su validacion final por junta.
- Eliminacion de inmueble: solo permitida si no tiene avisos/recibos generados.
- Carga masiva de inmuebles: no genera avisos automaticamente; importa estructura y saldos base.

---

## 6) Modelo de datos (resumen)

- `users`: autenticacion y actores del sistema.
- `condominios`: configuracion del condominio (perfil, reglas de cobranza, mensajes de aviso).
- `propiedades`: inmuebles (`identificador`, `alicuota`, `saldo_actual`, etc.).
- `usuarios_propiedades`: relacion propietario/inquilino con inmueble.
- `zonas`, `propiedades_zonas`: segmentacion por areas/sectores.
- `proveedores`: proveedores por condominio.
- `gastos`, `gastos_cuotas`: origen de deuda mensual y diferimiento.
- `recibos`: aviso/recibo por inmueble, con `snapshot_jsonb`.
- `pagos`: pagos de propietarios y su validacion.
- `cuentas_bancarias`, `fondos`, `movimientos_fondos`: tesoreria y trazabilidad.
- `cortes_estado_cuenta_fondos`: snapshots mensuales por aviso para consulta historica del propietario.
- `historial_saldos_inmuebles`: auditoria de ajustes/saldos iniciales.

---

## 7) Migraciones recientes

- `2026-03-16_add_condominios_profile_fields.sql`
- `2026-03-16_add_condominios_avisos_mensajes.sql`
- `2026-03-16_add_recibos_snapshot_jsonb.sql`
- `2026-03-16_add_gastos_clasificacion.sql`
- `2026-03-16_backfill_recibos_snapshot_gastos_clasificacion.sql`
- `2026-03-16_fondos_visibilidad_y_cortes_estado_cuenta.sql`

---

## 8) Convenciones de UI/UX implementadas

1. Vistas separadas en Configuracion (Bancos, Zonas, Inmuebles) y Contabilidad (Gastos, Cierres, Avisos, Cobranza).
2. En UI, "Zona" se presenta como "Area / Sector" segun contexto.
3. Modales desacopladas para rendimiento (`ModalAgregarGasto`, `ModalDetallesGasto`, `ModalFondos`, `ModalRegistrarPago`, `ModalPropiedadForm`, `ModalEstadoCuenta`, `ModalAjusteSaldo`, `ModalCargaMasiva`).
4. Soporte dark/light consistente.
5. Formato de montos en frontend: miles con `.` y decimales con `,`.

---

## 9) Vision final del modelo organizacional (JG -> JI -> Propietario)

La Junta General no es un "supervisor intrusivo" que ve quien vive en que apartamento, sino que trata a cada Junta Individual como si fuera un solo gran cliente o un "propietario gigante".

Bajo esta vision corregida y mucho mas precisa, asi es como queda la jerarquia y el flujo de Habioo al final del desarrollo:

### El Modelo de "Entidades Anidadas" (JG -> JI -> Propietario)

#### 1. Nivel Superior: Junta General (La Administradora Central)
La configuracion de la General es un reflejo de la Individual, pero a mayor escala.

- Vision: Solo ve a las Juntas Individuales como cuentas economicas. No tiene acceso a la lista de propietarios, ni a las zonas internas, ni a los pagos individuales de cada vecino.
- Relacion: La relacion JG-JI es identica a la relacion JI-Propietario. Para la General, una "Residencia" es equivalente a lo que un "Apartamento" es para la Individual.
- Accion principal: Registra gastos globales (ej: "Mantenimiento de Ascensores") y se los asigna a la Junta Individual correspondiente.

#### 2. Nivel Operativo: Junta Individual (El Condominio)
Es el "traductor" entre lo macro (General) y lo micro (Propietarios).

- Gestion de gastos: Recibe los gastos que le carga la Junta General.
- Distribucion automatica: Cuando la JI recibe un gasto de la General (ej: factura de vigilancia de $1,000), el sistema lo divide automaticamente entre sus propietarios basado en la alicuota o partes iguales, segun este configurada esa JI.
- Privacidad: Sus datos internos (quien debe, quien pago) son privados y no son visibles para la Junta General.

#### 3. Nivel final: El Propietario
- Visibilidad limitada y transparente: El propietario no ve los gastos de otros edificios de la Junta General.
- Su alcance: Solo ve la relacion economica de su Junta Individual con la General. Puede auditar en que se esta usando el dinero que su edificio le paga a la administracion central (transparencia de gastos y pagos JI -> JG).

### Resumen del flujo de un gasto

1. Gasto en la General: La Junta General carga un gasto de $500 por "Limpieza de Areas Comunes" a la Residencia A.
2. Deuda de la JI: La Residencia A (JI) ahora tiene una deuda de $500 con la Junta General.
3. Prorrateo interno: Internamente, el sistema de la Residencia A toma esos $500 y los reparte (ej: el Apto 1 paga $5, el Apto 2 paga $10, etc., segun su alicuota).
4. Recibo del propietario: Al propietario del Apto 2 le llega su aviso de cobro donde aparece el concepto "Limpieza Areas Comunes (Cuota General)" por valor de $10.
5. Auditoria del propietario: Si el propietario tiene dudas, puede entrar a su panel y ver: "Mi edificio (JI) le pago a la Junta General los $500 correspondientes a la limpieza de este mes".

### Conclusion del modelo

Este sistema es ciego hacia abajo (JG no ve propietarios) pero transparente hacia arriba (Propietario ve la relacion JI-JG).

---

## 10) Ejecucion local (frontend + backend)

1. Backend (`habioo-auth`):
   - Configurar `.env` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
   - Opcional: `ENABLE_TEST_SEEDER=true` para habilitar seeder de pruebas.
   - Ejecutar en `http://localhost:3000`.

2. Frontend (`habioo-frontend`):
   - Ejecutar Vite en `http://localhost:5173`.
   - `API_BASE_URL` se resuelve asi:
     - `VITE_API_BASE_URL` (si esta definida), o
     - `http://localhost:3000` cuando estas en localhost, o
     - `https://auth.habioo.cloud` en produccion.

3. Recomendacion para pruebas:
   - Si cambias de prod a local y ves `401`, limpia `localStorage` (token viejo) y vuelve a iniciar sesion.
