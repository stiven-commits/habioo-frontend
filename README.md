# Habioo - Plataforma de Gestión de Condominios

Este documento sirve como **Base de Conocimiento y Memoria de Contexto** sobre la arquitectura, base de datos y lógica de negocio del proyecto Habioo. 
La aplicación está compuesta por un Frontend (React + Vite + TailwindCSS) y un Backend (Express.js + PostgreSQL).

---

## 🛠️ Stack Tecnológico
- **Frontend**: React.js, Vite, React Router DOM, Tailwind CSS (Modo Oscuro/Claro integrado).
- **Backend**: Express.js, Node.js, `pg` (PostgreSQL), `jsonwebtoken` (Auth JWT), `bcryptjs`, `multer`, `sharp` (Procesamiento y optimización de imágenes webp).
- **Database**: PostgreSQL (hosteada externamente).

---

## 🏗️ Lógica de Negocio y Conceptos Clave

1. **Multitenancy Básico**: Un usuario (Administrador) está ligado a un registro en la tabla `condominios`. Toda la información (propiedades, gastos, zonas) se filtra usando este `condominio_id` vinculado al admin.
2. **Distribución de Gastos**: El sistema cuenta con 3 modos de asignación de gastos:
   - **Común**: El gasto afecta a todo el condominio. Se cobra utilizando el `metodo_division` del condominio (Alícuota % o Partes Iguales).
   - **Por Zona (Área / Sector)**: Afecta solo a las propiedades vinculadas a esa zona. 
   - **Individual**: Gasto directo imputado a un solo inmueble de forma íntegra.
3. **Diferimiento de Gastos (Cuotas)**: Un gasto puede dividirse en $N$ cuotas mensuales. Si se registra hoy un gasto diferido en 3 meses, el backend inserta 3 filas en `gastos_cuotas` proyectando cada cobro de forma secuencial en el tiempo.
4. **Cierres y Generación de Recibos**:
   - Cada condominio tiene un `mes_actual` contable. 
   - Durante el mes se registran los gastos. Al hacer el "Cierre de Ciclo" (`/cerrar-ciclo`), el backend calcula lo que cada propiedad debe (alícuotas + gastos individuales + gastos de sus zonas) y consolida la deuda mensual insertando registros en la tabla `recibos` con estado "Aviso de Cobro". Luego avanza el mes contable automáticamente.

---

## 📊 Estructura de la Base de Datos (PostgreSQL)

### 1. Usuarios y Seguridad
- **`users`**: Centraliza todos los usuarios (admins y residentes).
  - Campos clave: `id`, `cedula` (usado como login principal), `nombre`, `password`.
- **`condominios`**: Entidad principal que agrupa todo para un cliente de Habioo.
  - Campos clave: `id`, `admin_user_id` (FK a users), `mes_actual` (mes en facturación, ej: `2026-03`), `metodo_division`.

### 2. Infraestructura Habitacional
- **`propiedades`** (Inmuebles/Aptos): 
  - Campos: `id`, `condominio_id`, `identificador` (Ej: Apto 5B), `alicuota` (Porcentaje de participación).
- **`usuarios_propiedades`**: Pivot table para residentes. Asigna un `users.id` a un `propiedades.id` con un `rol` (Propietario / Inquilino).
- **`zonas`** (Visualmente "Áreas / Sectores"):
  - Campos: `id`, `condominio_id`, `nombre`, `activa`.
- **`propiedades_zonas`**: Qué propiedades conforman una zona o etapa en particular.

### 3. Contabilidad Administrativa
- **`proveedores`**:
  - Directorio comercial, campos: `id`, `identificador` (Rif/CI), `nombre`, `telefono1`, `direccion`.
- **`cuentas_bancarias`**: 
  - Dónde pagan los residentes. Relacionado al `condominio_id`.
- **`gastos`** (Factura / Deuda Madre): 
  - Campos: `id`, `condominio_id`, `proveedor_id`, `concepto`, `monto_bs`, `tasa_cambio`, `monto_usd`, `total_cuotas`, `tipo` ('Comun' | 'Zona' | 'Individual'), `zona_id` (opc), `propiedad_id` (opc).
  - Imágenes: `factura_img` (string única), `imagenes` (Array de strings para soportes). Guardados como WebP.
- **`gastos_cuotas`** (Fracciones del gasto):
  - Campos: `id`, `gasto_id`, `numero_cuota`, `monto_cuota_usd`, `mes_asignado`, `estado` ('Pendiente', 'Procesado').
- **`recibos`** (Resultado del cierre de mes):
  - El histórico de la deuda legal del apartamento. Campos: `id`, `propiedad_id`, `mes_cobro`, `monto_usd`, `estado`.

---

## 🖌️ Pautas de Frontend implementadas
1. **Rutas e Interfaces**: Divido en Vistas de Configuración (Zonas, Inmuebles, Bancos) y Vistas Contables (Gastos, Proveedores, Cierres, Cobranza).
2. **Nomenclatura Validada**: El concepto de "Zona" fue renombrado a nivel UI como "Área / Sector" mediante refactorización. Las variables en código se mantienen como `zonas` para respetar la BD.
3. **Modales Aligeradas**: Para mejorar el performance, las vistas complejas como Gastos modularizan sus diálogos (Ej: `ModalAgregarGasto.jsx` y `ModalDetallesGasto.jsx`).
4. **Tailwind Dark Mode**: Todo el desarrollo tiene diseño Dual State. Siempre se valida explícitamente el contraste usando prefijos `dark:`. Textos grises oscuros como `text-gray-800` en tema claro deben llevar un respectivo `dark:text-gray-200` o superior para evitar ilegibilidad.
