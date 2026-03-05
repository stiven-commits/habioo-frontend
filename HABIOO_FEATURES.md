# 🏢 Habioo: Sistema SaaS de Gestión de Condominios
**Documentación de Arquitectura y Funcionalidades (Actualizado: Marzo 2026)**

## 🛠️ Stack Tecnológico
* **Frontend:** React 19, Vite, Tailwind CSS v4, React Router DOM (SPA).
* **Backend (API):** Node.js, Express.js.
* **Base de Datos:** PostgreSQL 18.
* **Infraestructura:** VPS gestionado con Coolify.
* **Seguridad:** Autenticación por JWT (JSON Web Tokens), Contraseñas encriptadas con `bcryptjs`.

---

## 👥 Sistema de Identidad y Roles (Auth)
El sistema utiliza el **RBAC (Role-Based Access Control)** basado en la inicial del documento de identidad. Todo ingreso se "limpia" automáticamente (se eliminan guiones y espacios, todo en mayúscula, ej: `V12345678`).

* **Administrador (Junta de Condominio):** Identificadores que empiezan por `J` o `G`. Tienen acceso total a configuración y contabilidad.
* **Residente (Propietario / Inquilino):** Identificadores que empiezan por `V`, `E` o `P`. Solo ven el estado de cuenta de sus propiedades.

---

## 🎛️ Módulos del Administrador (Junta)

### 1. Configuración Base
* **💳 Cuentas Bancarias:** * Registro de métodos de pago donde la Junta recibe dinero (Transferencia Bs, Pago Móvil, Zelle, Efectivo USD/EUR, Banesco Panamá, Paypal).
  * *UX Inteligente:* Si es Zelle/Efectivo no pide cuenta bancaria, solo etiqueta o correo.
* **🏢 Zonificación (Zonas / Etapas):**
  * Creación de zonas (Ej: "Torre A", "Área Comercial").
  * Asignación múltiple (N:M): Un apartamento puede pertenecer a varias zonas simultáneamente.
  * *Auditoría:* Las zonas con historial de gastos no se pueden eliminar, solo desactivar/activar.

### 2. Comunidad
* **🏠 Inmuebles (Propiedades):**
  * Registro de casas/apartamentos con su Alícuota (%).
  * **Gestión de Identidad Automatizada:** Al vincular un Propietario o Inquilino con cédula, el sistema crea su usuario automáticamente en la base de datos si no existe (la clave por defecto es la cédula).
  * Capacidad de resetear claves o corregir datos de contacto desde la tabla.

### 3. Contabilidad y Tesorería
* **🤝 Proveedores:** Directorio maestro nacional, validado para no repetir identificadores (RIF).
* **🧾 Gastos:**
  * Registro de gastos bimonetarios (Monto en Bs + Tasa BCV = Cálculo en USD).
  * **Clasificación:** Gastos "Comunes" (afectan a todos) y "No Comunes" (asignados a una Zona específica).
  * **Amortización:** Capacidad de diferir gastos en N cuotas. El sistema proyecta los meses futuros basándose en el `mes_actual` del condominio (YYYY-MM).
  * Vista de historial en "Acordeón" y control de Auditoría (Gastos cobrados tienen candado 🔒 y no se pueden borrar).
* **🔒 Cierres y Recibos (Preliminar):**
  * Motor de simulación en tiempo real que suma la deuda del `mes_actual`.
  * **Calculadora de Proyección:** Permite seleccionar una alícuota existente y simular cuánto pagará ese apartamento antes de cerrar.
  * Botón de cierre: Procesa las cuotas, emite recibos oficiales y avanza el calendario del condominio al mes siguiente.
* **🗂️ Historial de Recibos:**
  * Tabla paginada (15 registros) de toda la cobranza emitida.
  * Visor de deudas (Total, Abonado, Falta).
* **💵 Registro de Pagos (Tesorería):**
  * Modal para que el Administrador registre abonos de los vecinos.
  * *Calculadora Multi-tasa:* Si el pago es en Bs, pide tasa de cambio; si es en divisas, asume conversión 1:1.
  * Conciliación automática: Cambia el recibo a "Abonado Parcial" o "Solvente" de acuerdo al saldo pagado.

---

## 🏡 Módulos del Residente

### 1. Mis Finanzas
* **Panel de Deudas:** Visualización de sus recibos emitidos filtrados por su `user_id`.
* **Reporte de Pago:** Flujo (en construcción/preparación) para enviar capturas de pantalla/referencias a la Junta para su validación en el estado de cuenta.

---

## ⚙️ Motor Lógico del Servidor (Reglas de Negocio Vitales)
1. **Calendario Cronológico (YYYY-MM):** El sistema no opera con "ciclos" genéricos, sino con meses calendario (ej: `2026-03`). Todos los gastos se inyectan en el mes de cobro que corresponda.
2. **Hard-Deletes Bloqueados:** Cuentas con pagos, zonas con gastos y gastos en recibos no pueden ser eliminados en cascada para proteger la integridad contable de ejercicios pasados.