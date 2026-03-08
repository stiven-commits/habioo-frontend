# Habioo - Plataforma de Gestión de Condominios

Documento de referencia funcional y técnica del estado actual de la app.
Este README fusiona la base conceptual original con el inventario actualizado de módulos, endpoints y modelo de datos.

- Última actualización: 2026-03-08
- Stack: React + Vite + Tailwind (frontend), Node/Express + PostgreSQL (backend)

---

## 1) Stack tecnológico

- Frontend: React, Vite, React Router DOM, Tailwind CSS (dark/light).
- Backend: Express, `pg`, `jsonwebtoken`, `bcryptjs`, `multer`, `sharp`.
- Base de datos: PostgreSQL.
- Archivos de imagen: `uploads/gastos` (factura principal + soportes en webp).

---

## 2) Lógica de negocio (resumen)

1. Multitenancy por condominio:
   - El administrador (`users`) está vinculado a `condominios.admin_user_id`.
   - Los datos operativos se filtran por `condominio_id`.

2. Arquitectura de gastos (3 niveles):
   - `Comun`: impacta a todo el condominio.
   - `Zona` / `No Comun`: impacta solo propiedades asociadas a la zona.
   - `Individual`: impacta 1 inmueble específico.

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
2. Proveedores: listar y crear.
3. Gastos: crear con factura/soportes, listar, eliminar (si cuotas pendientes).
4. Cierres: vista preliminar y cierre de ciclo.
5. Historial de avisos: filtros por texto/estado/fecha y registro de pago.
6. Bancos: listar, crear, eliminar, marcar predeterminada.
7. Fondos virtuales: listar, crear, eliminar por cuenta bancaria.
8. Zonas: listar, crear, editar, eliminar.
9. Propiedades: listar, crear, editar.
10. Dashboard residente: propiedades y resumen financiero.
11. Cuentas por cobrar (admin).

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
- `GET https://auth.habioo.cloud/proveedores` -> listar.
- `POST https://auth.habioo.cloud/proveedores` -> crear.

### Gastos
- `GET https://auth.habioo.cloud/gastos` -> listar gastos/cuotas.
- `POST https://auth.habioo.cloud/gastos` -> crear gasto (multipart: `factura_img`, `soportes`).
- `DELETE https://auth.habioo.cloud/gastos/:id` -> eliminar gasto.

### Cierres y recibos
- `GET https://auth.habioo.cloud/preliminar` -> preliminar contable del mes.
- `POST https://auth.habioo.cloud/cerrar-ciclo` -> generar recibos y avanzar mes.
- `GET https://auth.habioo.cloud/recibos-historial` -> historial de avisos/recibos.
- `GET https://auth.habioo.cloud/cuentas-por-cobrar` -> cobranza global admin.

### Pagos
- `POST https://auth.habioo.cloud/pagos-admin`
  - Registra pago y distribuye a fondos.

### Bancos y fondos
- `GET https://auth.habioo.cloud/bancos` -> listar cuentas.
- `POST https://auth.habioo.cloud/bancos` -> crear cuenta.
- `PUT https://auth.habioo.cloud/bancos/:id/predeterminada` -> marcar principal.
- `DELETE https://auth.habioo.cloud/bancos/:id` -> eliminar cuenta.
- `GET https://auth.habioo.cloud/fondos` -> listar fondos.
- `POST https://auth.habioo.cloud/fondos` -> crear fondo.
- `DELETE https://auth.habioo.cloud/fondos/:id` -> eliminar fondo sin movimientos.

### Zonas
- `GET https://auth.habioo.cloud/zonas` -> listar.
- `POST https://auth.habioo.cloud/zonas` -> crear.
- `PUT https://auth.habioo.cloud/zonas/:id` -> editar/activar/desactivar.
- `DELETE https://auth.habioo.cloud/zonas/:id` -> eliminar.

### Propiedades
- `GET https://auth.habioo.cloud/propiedades-admin` -> listar inmuebles.
- `POST https://auth.habioo.cloud/propiedades-admin` -> crear inmueble.
- `PUT https://auth.habioo.cloud/propiedades-admin` -> editar inmueble (backend actual).

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
- `propiedades`: inmuebles (`identificador`, `alicuota`, `zona_id`).
- `usuarios_propiedades`: relación usuario-inmueble (`Propietario` / `Inquilino`).
- `zonas`: áreas/sectores (`activa`).
- `propiedades_zonas`: relación N:M zona-propiedad.

### Proveedores y cuentas
- `proveedores`.
- `cuentas_bancarias`:
  - Campos clave actuales: `numero_cuenta`, `nombre_banco`, `apodo`, `tipo`, `es_predeterminada`, `nombre_titular`, `cedula_rif`, `telefono`.

### Gastos y facturación
- `gastos`:
  - Base del gasto: `monto_bs`, `tasa_cambio`, `monto_usd`, `tipo`, `zona_id`, `propiedad_id`, `fecha_gasto`, `created_at`.
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
  - Pagos por recibo (`monto_origen`, `monto_usd`, `tasa_cambio`, `moneda`, `estado`).
- `gastos_pagos_fondos`:
  - Relación de pagos de gastos con fondos (estructura disponible para expansión).

---

## 7) Discrepancias técnicas conocidas (para backlog)

1. Propiedades (PUT):
   - Front usa `PUT /propiedades-admin/:id`.
   - Backend usa `PUT /propiedades-admin` con `id` en body.
   - Recomendado: unificar contrato en una sola forma.

2. Rutas de pagos:
   - Flujo actual: `/pagos-admin`.
   - Existe flujo histórico en `/pagos` (no activo en frontend principal).
   - Recomendado: mantener una sola ruta canónica.

3. Módulo legacy:
   - `src/Dashboard.jsx` no está en router pero aún contiene lógica y fetches.
   - Recomendado: retirar o migrar.

---

## 8) Notas de sesión y seguridad

- Las rutas protegidas requieren `Authorization: Bearer <token>`.
- `Layout` valida sesión real con `/me`; si falla, limpia sesión y redirige a login.
- `HistorialAvisos` también maneja 401 explícito para evitar estados rotos.

---

## 9) Convenciones de UI/UX implementadas

1. Vistas separadas en Configuración (Bancos, Zonas, Inmuebles) y Contabilidad (Gastos, Cierres, Avisos, Cobranza).
2. En UI, "Zona" se presenta como "Área / Sector" según contexto.
3. Modales desacopladas para rendimiento (`ModalAgregarGasto`, `ModalDetallesGasto`, `ModalFondos`, `ModalRegistrarPago`).
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
