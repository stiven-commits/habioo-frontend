# Habioo - Plataforma de Gestión de Condominios

Documento de referencia funcional y técnica del estado actual de la app.
Este README fusiona la base conceptual original con el inventario actualizado de módulos, endpoints y modelo de datos.

- Última actualización: 2026-03-13
- Stack: React + Vite + Tailwind (frontend), Node/Express + PostgreSQL (backend)

---

## 1) Stack tecnológico

- Frontend: React, Vite, React Router DOM, Tailwind CSS (dark/light).
- Backend: Express, `pg`, `jsonwebtoken`, `bcryptjs`, `multer`, `sharp`.
- Base de datos: PostgreSQL.
- Archivos de imagen: `uploads/gastos` (factura principal + soportes en webp).

---

## 1.1) Remanufacturación del backend (marzo 2026)

El backend fue refactorizado de un archivo monolítico a módulos por dominio, manteniendo la misma API pública para el frontend.

- `index.js` ahora solo inicializa la app y registra rutas.
- Capas nuevas:
  - `config/db.js`
  - `middleware/verifyToken.js`
  - `utils/calendar.js`
  - `utils/number.js`
  - `services/pagosColumns.js`
- Rutas separadas en `routes/*.js`:
  - `root`, `auth`, `gastos`, `proveedores`, `propiedades`, `bancos`, `zonas`, `recibos`, `fondos`, `pagos`, `dashboard`.

Impacto:
- Se conserva compatibilidad de URLs/métodos actuales.
- Mejor mantenibilidad y menor riesgo al extender funcionalidades.

---

## 1.2) Memoria técnica de remanufacturación TS/TSX (frontend, marzo 2026)

Se hizo una remanufacturación progresiva de pantallas y modales a TypeScript estricto, cuidando no alterar JSX visual, clases Tailwind ni flujos de hooks.

### Alcance principal trabajado

- Páginas: `CuentasPorCobrar.tsx`, `Cierres.tsx`, `EstadoCuentasBancarias.tsx`, `Gastos.tsx`, `Propiedades.tsx`, `Proveedores.tsx`, `Bancos.tsx`.
- Componentes/modales: `ModalRegistrarPago.tsx`, `ModalFondos.tsx`, `ModalAgregarGasto.tsx`, `BancosModals.tsx`, `DialogProvider.tsx`, `PropiedadesModals.tsx`.
- Utilidades/config ya migradas a `.ts` en el flujo previo de trabajo.

### Reglas y decisiones de tipado que se aplicaron

1. `exactOptionalPropertyTypes`:
   - Evitar pasar `undefined` explícito en props opcionales.
   - Cuando un campo es opcional, agregarlo solo si existe (en vez de `campo: undefined`).

2. `noUncheckedIndexedAccess`:
   - Proteger accesos por índice:
     - `arr[0] ?? ''`
     - `const [a = ''] = str.split('...')`
     - `obj[key]?.prop ?? fallback`

3. Contratos entre páginas y modales:
   - Se alinearon tipos de props para evitar incompatibilidades entre interfaces con el mismo nombre pero distinta forma.
   - Donde fue necesario, se usaron adaptadores de `setState` para respetar firmas esperadas por modales sin cambiar lógica funcional.

4. Eventos y formularios:
   - Handlers tipados explícitamente (`ChangeEvent`, `FormEvent`, etc.).
   - Guardas para `checkbox` con `instanceof HTMLInputElement`.

5. Respuestas API:
   - Interfaces explícitas para payloads relevantes de frontend.
   - Normalización numérica en cálculos contables para evitar unions ambiguas.

### Problemas reales detectados y cómo evitarlos

- Error de codificación (mojibake / `�`):
  - Se presentó en varios archivos durante cambios sucesivos de encoding.
  - Recomendación: mantener todos los `.ts/.tsx` en UTF-8.
  - Evitar mezclar escrituras `Default/ANSI` y UTF-8 en el mismo archivo.

- Error TS2719 (tipos “iguales” pero no relacionados):
  - Ocurre por interfaces duplicadas con mismo nombre en distintos módulos.
  - Recomendación: centralizar tipos compartidos en un módulo común (`src/types/...`) o alinear estructura exacta al pasar props.

### Comandos útiles de verificación rápida

- Validación global frontend:
  - `npx tsc --noEmit`
- Validar un archivo específico por nombre:
  - `npx tsc --noEmit 2>&1 | Select-String -Pattern 'NombreArchivo.tsx'`
- Build frontend:
  - `npm run build`

### Nota para continuidad (memoria IA)

Si se retoma este proyecto con contexto nuevo:
- Priorizar revisión de contratos de props entre páginas y modales antes de tocar lógica.
- Revisar encoding UTF-8 de archivos que muestren símbolos raros.
- Antes de cambios grandes, ejecutar `npx tsc --noEmit` y atacar errores por archivo con `Select-String`.

---

## 2) Lógica de negocio (resumen)

1. Multitenancy por condominio:
   - El administrador (`users`) está vinculado a `condominios.admin_user_id`.
   - Los datos operativos se filtran por `condominio_id`.

2. Arquitectura de gastos (4 niveles):
   - `Comun`: impacta a todo el condominio.
   - `Zona` / `No Comun`: impacta solo propiedades asociadas a la zona.
   - `Individual`: impacta 1 inmueble específico.
   - `Extra`: gasto común extraordinario (se distribuye como `Comun`).

3. Diferimiento por cuotas:
   - Un gasto se divide en `total_cuotas`.
   - Se generan filas en `gastos_cuotas` por mes (`mes_asignado` tipo `YYYY-MM`).

4. Cierre mensual:
   - El condominio tiene `mes_actual`.
   - `POST /cerrar-ciclo` genera recibos (`recibos`) y avanza al siguiente mes.

5. Pagos y fondos virtuales:
   - Los pagos se registran en `pagos`.
   - Se distribuyen automáticamente a `fondos` según porcentaje.
   - Se auditan en `movimientos_fondos`.

---

## 3) Estado funcional del frontend

### 3.1 Funcionalidades activas

1. Login y sesión JWT (`/login` + validación `/me` en `Layout`).
2. Proveedores: listar/crear/editar/eliminar (borrado lógico) por junta (aislados por condominio).
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

### 3.2 Funcionalidades inactivas/parciales

1. `src/Dashboard.jsx` (legacy): no está enrutado en `App.jsx`.
2. Modal de impresión en `HistorialAvisos`: placeholder visual.
3. `POST /register`: existe backend pero sin flujo UI activo.
4. `POST /pagos` histórico: el flujo actual usa `/pagos-admin`.

---

## 4) Rutas frontend activas

- `/` -> Login
- `/dashboard` -> DashboardHome
- `/proveedores` -> Proveedores
- `/gastos` -> Gastos
- `/cierres` -> Cierres
- `/inmuebles` -> Propiedades
- `/cuentas-cobrar` -> CuentasPorCobrar
- `/bancos` -> Bancos
- `/estado-cuentas` -> EstadoCuentasBancarias (Libro Mayor)
- `/zonas` -> Zonas
- `/avisos-cobro` -> HistorialAvisos

---

## 5) Mapa de URLs (frontend -> backend -> acción)

### Auth y sesión
- `POST https://auth.habioo.cloud/login`
  - Front: `src/pages/Login.jsx`
  - Acción: autentica y devuelve token.
- `GET https://auth.habioo.cloud/me` (protegida)
  - Front: `src/components/Layout.jsx`
  - Acción: valida token vigente.

### Proveedores
- `GET https://auth.habioo.cloud/proveedores` -> listar proveedores activos del condominio del admin autenticado.
- `POST https://auth.habioo.cloud/proveedores` -> crear proveedor en el condominio del admin (reactiva si existía inactivo con mismo RIF). Incluye validación de `email`.
- `PUT https://auth.habioo.cloud/proveedores/:id` -> editar datos de contacto/rubro del proveedor. Incluye validación de `email`.
- `DELETE https://auth.habioo.cloud/proveedores/:id` -> borrado lógico (`activo = false`).
- `POST https://auth.habioo.cloud/proveedores/lote` -> carga masiva de proveedores (Excel) con validación de `email` por fila.

### Gastos
- `GET https://auth.habioo.cloud/gastos` -> listar gastos/cuotas.
- `POST https://auth.habioo.cloud/gastos` -> crear gasto (multipart: `factura_img`, `soportes`) para tipos `Comun`, `Zona`, `Individual`, `Extra`.
- `DELETE https://auth.habioo.cloud/gastos/:id` -> eliminar gasto.

### Cierres y recibos
- `GET https://auth.habioo.cloud/preliminar` -> preliminar contable del mes.
- `POST https://auth.habioo.cloud/cerrar-ciclo` -> generar recibos y avanzar mes.
- `GET https://auth.habioo.cloud/recibos-historial` -> historial de avisos/recibos.
- `GET https://auth.habioo.cloud/cuentas-por-cobrar` -> cobranza global admin.

### Pagos
- `POST https://auth.habioo.cloud/pagos-admin`
  - Registra pago de administrador por `propiedad_id` (auto-validado), distribuye a fondos y aplica cascada FIFO sobre recibos.
- `POST https://auth.habioo.cloud/pagos/:id/validar`
  - Valida pagos pendientes y aplica cascada FIFO de imputación.

### Bancos y fondos
- `GET https://auth.habioo.cloud/bancos` -> listar cuentas.
- `POST https://auth.habioo.cloud/bancos` -> crear cuenta.
  - Tipos soportados en UI: `Transferencia (Bs)`, `Pago Móvil (Bs)`, `Zelle (USD)`, `Efectivo / Caja Fuerte (Bs)`, `Efectivo / Caja Fuerte (USD)`.
  - La moneda base se autodefine por tipo cuando aplica (nacional -> `BS`, internacional -> `USD`) y solo se habilita manualmente en tipos genéricos.
- `PUT https://auth.habioo.cloud/bancos/:id/predeterminada` -> marcar principal.
- `DELETE https://auth.habioo.cloud/bancos/:id` -> eliminar cuenta.
- `GET https://auth.habioo.cloud/fondos` -> listar fondos.
- `POST https://auth.habioo.cloud/fondos` -> crear fondo.
- `DELETE https://auth.habioo.cloud/fondos/:id` -> eliminar fondo sin movimientos.
- `GET https://auth.habioo.cloud/bancos-admin/:id/estado-cuenta` -> libro mayor de la cuenta (movimientos y saldos).
- `GET https://auth.habioo.cloud/gastos-pendientes-pago` -> gastos/facturas pendientes para pago a proveedor.
- `POST https://auth.habioo.cloud/pagos-proveedores` -> registrar pago parcial o total de gasto con imputación multiorigen (múltiples cuentas/fondos en una sola operación).
- `POST https://auth.habioo.cloud/transferencias` -> transferir entre fondos/cuentas (con o sin conversión).

Notas de desarrollo local:
- En código frontend, Bancos/Fondos usan `API_BASE_URL` (`src/config/api.js`) en lugar de URLs hardcodeadas a producción.
- Archivos actualizados para local-first: `src/pages/Bancos.jsx`, `src/components/ModalFondos.jsx`, `src/components/BancosModals.jsx`.

### Zonas
- `GET https://auth.habioo.cloud/zonas` -> listar.
- `POST https://auth.habioo.cloud/zonas` -> crear.
- `PUT https://auth.habioo.cloud/zonas/:id` -> editar/activar/desactivar.
- `DELETE https://auth.habioo.cloud/zonas/:id` -> eliminar.

### Propiedades
- `GET https://auth.habioo.cloud/propiedades-admin` -> listar inmuebles.
- `POST https://auth.habioo.cloud/propiedades-admin` -> crear inmueble.
- `PUT https://auth.habioo.cloud/propiedades-admin/:id` -> editar inmueble.
- `GET https://auth.habioo.cloud/propiedades-admin/:id/estado-cuenta` -> movimientos de cuenta del inmueble.
- `POST https://auth.habioo.cloud/propiedades-admin/:id/ajustar-saldo` -> ajuste manual de saldo (deuda/a favor).
- `POST https://auth.habioo.cloud/propiedades-admin/lote` -> carga masiva de inmuebles (Excel/lote).

### Dashboard residente
- `GET https://auth.habioo.cloud/mis-propiedades` -> propiedades del usuario.
- `GET https://auth.habioo.cloud/mis-finanzas` -> resumen financiero.

### API externa
- `GET https://ve.dolarapi.com/v1/dolares/oficial` -> tasa BCV (modal de pago).

---

## 6) Modelo de datos (estructura actual relevante)

### Seguridad y núcleo
- `users`: usuarios (admin y residentes).
- `condominios`: condominio y configuración contable (`mes_actual`, `metodo_division`).

### Habitacional
- `propiedades`: inmuebles (`identificador`, `alicuota`, `zona_id`, `saldo_actual`).
- `usuarios_propiedades`: relación usuario-inmueble (`Propietario` / `Inquilino`).
- `zonas`: áreas/sectores (`activa`).
- `propiedades_zonas`: relación N:M zona-propiedad.
- `historial_saldos_inmuebles`: auditoría de saldos (`SALDO_INICIAL`, `CARGAR_DEUDA`, `AGREGAR_FAVOR`).

### Proveedores y cuentas
- `proveedores`.
  - Alcance por junta: cada registro se asocia a `condominio_id` y no se comparte entre condominios.
  - Borrado lógico: columna `activo` para ocultar sin perder trazabilidad histórica.
  - Nuevos campos relevantes: `rubro`, `email`, `condominio_id`, `activo`.
- `cuentas_bancarias`:
  - Campos clave actuales: `numero_cuenta`, `nombre_banco`, `apodo`, `tipo`, `es_predeterminada`, `nombre_titular`, `cedula_rif`, `telefono`.
  - Convención vigente de tipos: `Transferencia`, `Pago Movil`, `Zelle`, `Efectivo BS`, `Efectivo USD`.

### Gastos y facturación
- `gastos`:
  - Base del gasto: `monto_bs`, `tasa_cambio`, `monto_usd`, `tipo`, `zona_id`, `propiedad_id`, `fecha_gasto`, `created_at`.
  - `tipo` soportado actualmente: `Comun`, `No Comun`, `Zona`, `Individual`, `Extra`.
  - Soportes: `factura_img` (principal), `imagenes` (array de soportes).
- `gastos_cuotas`:
  - Fracciones mensuales: `numero_cuota`, `monto_cuota_usd`, `mes_asignado`, `estado`.
- `recibos`:
  - Resultado del cierre mensual por inmueble.

### Fondos y pagos
- `fondos`:
  - Fondo virtual anclado a cuenta bancaria (`cuenta_bancaria_id`), con porcentaje y saldo.
- `movimientos_fondos`:
  - Auditoría de ingresos/egresos/ajustes.
- `pagos`:
  - Pagos por propiedad/recibo (`monto_origen`, `monto_usd`, `tasa_cambio`, `moneda`, `estado`, `propiedad_id`, `cuenta_bancaria_id`).
- `recibos`:
  - Incluye `monto_pagado_usd` para control de abonos parciales y liquidación total por cascada.
- `gastos_pagos_fondos`:
  - Relación de pagos de gastos con fondos (estructura disponible para expansión).
- `pagos_proveedores`:
  - Pagos aplicados a gastos (parciales/totales) con orígenes múltiples; soporta referencia por origen, fecha y nota global.
- `transferencias`:
  - Movimientos entre fondos/cuentas con soporte de tasa de cambio y montos origen/destino.
- `gastos.monto_pagado_usd`:
  - Acumulado pagado por gasto para control de deuda pendiente.

---

## 7) Novedades funcionales recientes

1. Propiedades:
   - Corrección de guardado completo en crear/editar (propietario + inquilino).
   - `alicuota` con coma decimal en UI y límite operativo de 3 decimales.
   - Ajuste manual de saldo por inmueble y estado de cuenta con cargos/abonos.
   - En el registro de inmueble se agregó captura de `Saldo Inicial (Bs)`, `Tasa BCV` y cálculo automático a `Saldo Inicial (USD)` con botón de consulta BCV.
   - Carga masiva desde Excel con validaciones (apto, nombre, cédula, alícuota y duplicados de correo).
   - Paginación de la tabla principal ajustada a 13 inmuebles por página.
   - Modales desacopladas en `src/components/propiedades/PropiedadesModals.jsx`.
   - La acción `Estado de Cuenta` fue retirada del dropdown de `Inmuebles`.
   - Alta de usuarios desde inmueble: si no se define contraseña explícita, la clave inicial se establece igual a la cédula.
2. Inquilinos:
   - Se agregó toggle en la modal: `Permitir acceso del inquilino al portal`.
   - Persistencia en BD: `usuarios_propiedades.acceso_portal` (default `true`).
   - Login bloquea usuarios residentes/inquilinos cuando todas sus relaciones están con `acceso_portal=false`.
   - Endpoints de residente (`/mis-propiedades`, `/mis-finanzas`) solo devuelven relaciones con `acceso_portal=true`.
3. Gastos:
   - Migración de ciclos numéricos a meses calendario (`mes_actual`, `mes_asignado`).
   - Doble fecha de gasto (`fecha_gasto` y `created_at`).
   - Soportes de imagen: `factura_img` + `imagenes[]`.
   - En UI, `Distribución (asignación)` pasó a llamarse `Tipo de gasto`.
   - Nuevo tipo de gasto `Extra` agregado en frontend/backend/BD.
   - Vista `/gastos`:
     - título actualizado a `Gastos` (no solo comunes),
     - tarjetas de resumen por tipo (Comun, Zona, Individual, Extra),
     - filtro por rango de fecha + botón `Limpiar`,
     - filtros por tipo con mejor contraste en tema oscuro,
     - tabla paginada a 13 filas,
     - orden de columnas ajustado (`Monto Total` antes de `Cuotas`).
   - Modal de detalle de gasto:
     - etiqueta `Cargado el` (antes `sistema`),
     - muestra `Notas` y fallback `Sin notas` si no existe.
4. Bancos y fondos:
   - Cuenta predeterminada (`PUT /bancos/:id/predeterminada`) activa.
   - Fondos virtuales anclados a cuentas bancarias con trazabilidad.
   - Nueva vista `Libro Mayor` (`/estado-cuentas`) con estado de cuenta por banco/cuenta.
   - Alta de cuenta actualizada con tipos explícitos de efectivo en dos monedas: `Efectivo / Caja Fuerte (Bs)` y `Efectivo / Caja Fuerte (USD)`.
   - Modales operativas para `Pagar Proveedor` y `Transferencia` entre fondos.
   - Integración con endpoints `GET /bancos-admin/:id/estado-cuenta`, `POST /pagos-proveedores`, `POST /transferencias`, `GET /gastos-pendientes-pago`.
   - Pago a proveedor con carrito de orígenes:
     - permite distribuir un mismo pago entre múltiples cuentas/fondos;
     - soporta Bs y USD por fila con tasa BCV por origen en Bs;
     - valida sobrepago al gasto y saldo insuficiente por fondo (incluyendo suma de múltiples filas sobre un mismo fondo).
5. Pagos:
   - Flujo consolidado en `POST /pagos-admin` con registro por `propiedad_id`.
   - Validación manual disponible en `POST /pagos/:id/validar`.
   - Cascada FIFO: el abono se aplica del recibo más antiguo al más reciente.
   - Actualización automática de `propiedades.saldo_actual` y de `recibos.monto_pagado_usd`/`estado` (`Pagado` o `Parcial`).
6. Historial de avisos:
   - Filtros activos por texto, estado y rango de fechas.
   - Pestañas de estados alineadas visualmente con el patrón de `Gastos`.
   - Se retiró la acción de pagar desde esta vista.
7. Cobranza (ajuste de flujo):
   - Se centraliza la gestión operativa por inmueble con deuda.
   - Incluye acciones `Estado de Cuenta` y `Registrar Pago` por fila.
   - Mantiene paginación de 13 registros por página.
8. Desarrollo local:
   - Se incorporó `src/config/api.js` con `API_BASE_URL` dinámico.
   - En local (`localhost/127.0.0.1`) usa `http://localhost:3000` por defecto.
   - `main.jsx` reescribe automáticamente llamadas legacy a `https://auth.habioo.cloud` hacia la base local para evitar romper pruebas.
9. Proveedores (nuevo alcance por junta):
   - Listado aislado por `condominio_id` (cada junta ve solo sus propios proveedores).
   - Se agregó `rubro` al proveedor.
   - Se habilitó borrado lógico con `activo` (eliminar oculta, no destruye).
   - Alta inteligente: si un proveedor del mismo condominio existe inactivo con el mismo RIF, se reactiva y actualiza.
10. UX de notificaciones (nuevo):
   - Se agregó proveedor global de diálogos: `src/components/ui/DialogProvider.jsx`.
   - `App.jsx` quedó envuelto con `DialogProvider` para habilitar modales centradas en toda la app.
   - Se unificaron mensajes de acciones en gestión bancaria (crear/eliminar cuenta, predeterminada, crear/eliminar fondo, pagar proveedor, transferir).
   - Se mejoró contraste en selects/botones de modales de transferencia y pago para dark/light.
11. Seeder de pruebas (dashboard-admin):
   - `POST /dashboard-admin/seed-prueba` ahora limpia completamente los datos operativos del condominio (pruebas viejas/manuales) antes de poblar.
   - Escenario sembrado actualizado:
     - 20 inmuebles de prueba con saldos mixtos (deuda, a favor y cero).
     - 20 propietarios vinculados (clave inicial = cédula).
     - 8 proveedores de prueba con correo (`email`) y datos de contacto.
     - 4 cuentas bancarias de prueba: 3 cuentas en `BS` y 1 cuenta en `USD`.
     - 4 fondos de prueba alineados con las cuentas y su moneda (1 por cuenta).
     - 14 gastos con mezcla de tipos (incluye `Extra`) y varios en 4 cuotas para pruebas de cierre/cobranza.
12. Proveedores (front + back + BD):
   - BD: se agregó columna `proveedores.email`.
   - Backend: `POST/PUT /proveedores` y `POST /proveedores/lote` validan y persisten `email`.
   - Frontend:
     - Formulario individual de proveedor incluye `email` obligatorio.
     - Vista detalle muestra `email`.
     - Carga masiva Excel agrega columna `Email` y valida formato antes de enviar.

---

## 8) Notas de sesión y seguridad

- Las rutas protegidas requieren `Authorization: Bearer <token>`.
- `Layout` valida sesión real con `/me`; si falla, limpia sesión y redirige a login.
- `HistorialAvisos` también maneja 401 explícito para evitar estados rotos.

---

## 11) Ejecución local (frontend + backend)

1. Backend (`habioo-auth`):
   - Configurar `.env` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
   - Ejecutar en `http://localhost:3000`.

2. Frontend (`habioo-frontend`):
   - Ejecutar Vite en `http://localhost:5173`.
   - `API_BASE_URL` se resuelve así:
     - `VITE_API_BASE_URL` (si está definida), o
     - `http://localhost:3000` cuando estás en localhost, o
     - `https://auth.habioo.cloud` en producción.

3. Recomendación para pruebas:
   - Si cambias de prod a local y ves `401`, limpia `localStorage` (token viejo) y vuelve a iniciar sesión.

---

## 9) Convenciones de UI/UX implementadas

1. Vistas separadas en Configuración (Bancos, Zonas, Inmuebles) y Contabilidad (Gastos, Cierres, Avisos, Cobranza).
2. En UI, "Zona" se presenta como "Área / Sector" según contexto.
3. Modales desacopladas para rendimiento (`ModalAgregarGasto`, `ModalDetallesGasto`, `ModalFondos`, `ModalRegistrarPago`, `ModalPropiedadForm`, `ModalEstadoCuenta`, `ModalAjusteSaldo`, `ModalCargaMasiva`).
4. Soporte dark/light consistente.
5. Formato de montos en frontend: miles con `.` y decimales con `,`.

---

## 10) Visión final del modelo organizacional (JG -> JI -> Propietario)

La Junta General no es un "supervisor intrusivo" que ve quién vive en qué apartamento, sino que trata a cada Junta Individual como si fuera un solo gran cliente o un "propietario gigante".

Bajo esta visión corregida y mucho más precisa, así es como queda la jerarquía y el flujo de Habioo al final del desarrollo:

### 🏢 El Modelo de "Entidades Anidadas" (JG -> JI -> Propietario)

#### 1. Nivel Superior: Junta General (La Administradora Central)
La configuración de la General es un reflejo de la Individual, pero a mayor escala.

- Visión: Solo ve a las Juntas Individuales como cuentas económicas. No tiene acceso a la lista de propietarios, ni a las zonas internas, ni a los pagos individuales de cada vecino.
- Relación: La relación JG-JI es idéntica a la relación JI-Propietario. Para la General, una "Residencia" es equivalente a lo que un "Apartamento" es para la Individual.
- Acción principal: Registra gastos globales (ej: "Mantenimiento de Ascensores") y se los asigna a la Junta Individual correspondiente.

#### 2. Nivel Operativo: Junta Individual (El Condominio)
Es el "traductor" entre lo macro (General) y lo micro (Propietarios).

- Gestión de gastos: Recibe los gastos que le carga la Junta General.
- Distribución automática: Cuando la JI recibe un gasto de la General (ej: factura de vigilancia de $1,000), el sistema lo divide automáticamente entre sus propietarios basado en la alícuota o partes iguales, según esté configurada esa JI.
- Privacidad: Sus datos internos (quién debe, quién pagó) son privados y no son visibles para la Junta General.

#### 3. Nivel final: El Propietario
- Visibilidad limitada y transparente: El propietario no ve los gastos de otros edificios de la Junta General.
- Su alcance: Solo ve la relación económica de su Junta Individual con la General. Puede auditar en qué se está usando el dinero que su edificio le paga a la administración central (transparencia de gastos y pagos JI -> JG).

### 🧬 Resumen del flujo de un gasto

1. Gasto en la General: La Junta General carga un gasto de $500 por "Limpieza de Áreas Comunes" a la Residencia A.
2. Deuda de la JI: La Residencia A (JI) ahora tiene una deuda de $500 con la Junta General.
3. Prorrateo interno: Internamente, el sistema de la Residencia A toma esos $500 y los reparte (ej: el Apto 1 paga $5, el Apto 2 paga $10, etc., según su alícuota).
4. Recibo del propietario: Al propietario del Apto 2 le llega su aviso de cobro donde aparece el concepto "Limpieza Áreas Comunes (Cuota General)" por valor de $10.
5. Auditoría del propietario: Si el propietario tiene dudas, puede entrar a su panel y ver: "Mi edificio (JI) le pagó a la Junta General los $500 correspondientes a la limpieza de este mes".

### 🎯 Conclusión del modelo

Este sistema es ciego hacia abajo (JG no ve propietarios) pero transparente hacia arriba (Propietario ve la relación JI-JG).
