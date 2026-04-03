# Habioo - README para asistencia (README-BOT)

Guia operativa para asistentes IA y soporte funcional.

- Ultima actualizacion: 2026-04-03
- Objetivo: orientar acciones segun rol, modulos y restricciones reales del sistema.

Las etiquetas [JUNTA], [PROPIETARIO], [AMBOS], [SOPORTE], [JUNTA_GENERAL] indican que perfil puede realizar cada accion. Son de uso interno del agente: nunca las muestres al usuario.

---

## 1) Roles del sistema

### Administrador / Junta (etiqueta interna: [JUNTA])
Rol administrativo de una junta individual de condominio. Accede a la operacion contable y administrativa completa del condominio que administra.

### Propietario (etiqueta interna: [PROPIETARIO])
Rol de residente o copropietario. Solo ve informacion y acciones relacionadas con su(s) inmueble(s).

### Junta General (etiqueta interna: [JUNTA_GENERAL])
Rol que agrupa multiples juntas individuales. Opera como ente economico superior. No ve propietarios ni inmuebles individuales. Solo ve juntas individuales como cuentas.

### SuperUsuario / Soporte (etiqueta interna: [SOPORTE])
Rol de administrador de la plataforma Habioo. Puede acceder al panel de cualquier condominio desde `/soporte/condominios`. Las URLs toman la forma `/soporte/:condominioId/modulo`.

---

## 2) Rutas frontend por rol

### Junta [JUNTA]
- `/dashboard` — panel principal con KPIs
- `/junta-general` — gestion de Junta General (solo si aplica)
- `/perfil` — perfil del condominio
- `/proveedores` — catalogo de proveedores
- `/gastos` — registro y gestion de gastos
- `/cierres` — cierre mensual y preliminar
- `/inmuebles` — gestion de inmuebles/propiedades
- `/cuentas-cobrar` — cobranza y pagos de propietarios
- `/bancos` — cuentas bancarias y fondos
- `/estado-cuentas` — libro mayor bancario
- `/zonas` — areas y sectores
- `/alquileres` — espacios en alquiler y solicitudes
- `/carta-consulta` — encuestas a propietarios
- `/avisos-cobro` — historial de avisos generados
- `/aviso-cobro/:id` — detalle de un aviso de cobro

### Propietario [PROPIETARIO]
- `/propietario/gastos` — gastos del condominio (solo lectura)
- `/propietario/recibos` — avisos de cobro recibidos
- `/propietario/estado-cuenta` — estado de cuenta general
- `/propietario/estado-cuenta-inmueble` — estado de cuenta por inmueble
- `/propietario/alquileres` — reservar espacios y ver solicitudes
- `/propietario/perfil` — editar perfil personal
- `/propietario/notificaciones` — notificaciones recibidas
- `/mis-cartas-consulta` — encuestas y votaciones

### Publicas (sin autenticacion)
- `/login`
- `/registro-junta`

---

## 3) Que puede hacer cada rol

### Junta [JUNTA]
- Gestionar proveedores, gastos, cierres, avisos y cobranzas.
- Gestionar cuentas bancarias y fondos.
- Registrar y validar pagos de propietarios.
- Aplicar ajustes de saldo por inmueble.
- Revertir pagos validados, ajustes bancarios, transferencias y egresos manuales.
- Gestionar encuestas y alquileres.
- Aprobar o rechazar reservas y pagos de alquiler de propietarios.
- Ver y gestionar inmuebles y zonas.

### Propietario [PROPIETARIO]
- Ver gastos del condominio (solo lectura).
- Ver sus recibos y avisos de cobro.
- Ver su estado de cuenta general y por inmueble.
- Registrar pagos (quedan pendientes de aprobacion por la junta).
- Ver y participar en encuestas.
- Reservar amenidades y reportar pago de reservaciones.
- Editar su perfil personal.
- Ver notificaciones del condominio.

### Junta General [JUNTA_GENERAL]
- Registrar juntas individuales vinculadas.
- Ver estado de cuenta de cada junta individual (como proveedor/cliente).
- Ver conciliacion de gastos distribuidos entre juntas.
- Gestionar miembros de la Junta General.
- No puede ver inmuebles, propietarios ni detalles internos de las juntas individuales.
- Accede principalmente desde `/junta-general`.

---

## 4) Mapa de modulos y botones

### Dashboard (`/dashboard`) [JUNTA]
Solo lectura. Muestra KPIs, graficos de cobranza, alertas de pendientes y movimientos recientes.
No se puede crear ni modificar nada desde el dashboard.

### Gastos (`/gastos`) [JUNTA]
- Crear gasto: boton `+ Nuevo Gasto` en la parte superior derecha.
- Filtrar por tipo: tabs `Todos`, `Comunes`, `Por Areas/Sectores`, `Individuales`, `Extra`.
- Ver detalle: menu de acciones por fila → `Ver Detalles`.
- Editar gasto: menu de acciones por fila → `Editar`.
- Pagar proveedor: menu de acciones por fila → `Pagar Proveedor`. Disponible aunque el gasto no este en avisos de cobro aun. Si el gasto no fue incluido en avisos, aparece confirmacion previa indicando que afecta el estado de cuenta bancario.
- Ver pagos del gasto: menu de acciones por fila → `Ver Pagos`.
- Eliminar gasto: menu de acciones por fila → `Eliminar`.

### Gastos (`/propietario/gastos`) [PROPIETARIO]
Solo lectura. El propietario puede ver los gastos del condominio pero no puede crear, editar ni eliminar.

### Cierres (`/cierres`) [JUNTA]
- Ver preliminar del periodo actual antes de cerrar.
- Ejecutar cierre mensual: boton `Cerrar Ciclo`.
- Cambiar metodo de division de gastos: boton `Cambiar metodo de division`.
- El cierre genera los avisos de cobro para todos los propietarios del periodo.

### Avisos de cobro (`/avisos-cobro`) [JUNTA]
- Filtrar: rango de fecha, estado (Todos, Pagados, Abonado, Pendiente), busqueda.
- Abrir/imprimir aviso: boton de accion por fila.
- Los avisos son snapshots inmutables generados en el cierre.

### Recibos (`/propietario/recibos`) [PROPIETARIO]
El propietario ve aqui sus avisos de cobro recibidos.

### Cuentas por Cobrar (`/cuentas-cobrar`) [JUNTA]
- Tabs: `Deudores` (con saldo pendiente) / `Todos`.
- Registrar pago de propietario: boton `Registrar Pago` en columna de acciones.
- Ver estado de cuenta de un inmueble: boton `Ver Estado de Cuenta`.
- Aprobar pagos pendientes: seccion de pendientes de aprobacion en la misma vista.

### Estado de Cuentas / Libro Mayor (`/estado-cuentas`) [JUNTA]
- Filtros: campos `Desde`, `Hasta`, `Buscar`, boton `Limpiar`.
- Aumentar fuente de la tabla: boton `A+` al lado de `Limpiar`.
- Ver detalle de movimiento: doble clic sobre una fila.
- Revertir movimiento: columna `Acciones` → boton `Revertir`.
- Movimientos reversibles: pagos validados, ajustes bancarios, pagos a proveedor, transferencias entre fondos, egresos bancarios y manuales.

### Estado de cuenta propietario (`/propietario/estado-cuenta`) [PROPIETARIO]
El propietario ve aqui su balance general de deuda con el condominio.

### Estado de cuenta por inmueble (`/propietario/estado-cuenta-inmueble`) [PROPIETARIO]
El propietario ve el detalle de movimientos de su inmueble especifico.

### Bancos (`/bancos`) [JUNTA]
- Crear cuenta bancaria: boton `+ Nueva Cuenta Bancaria`.
- Editar cuenta: menu `Opciones` por fila.
- Eliminar cuenta: menu `Opciones` → `Eliminar`.
- Marcar cuenta como predeterminada: menu `Opciones` → `Hacer Principal`.
- Ver fondos de una cuenta: accion por fila `Ver Fondos`.

### Fondos (modal desde Bancos) [JUNTA]
- Crear fondo: boton `+ Nuevo Fondo`.
- Editar configuracion (nombre, operativo, visibilidad): acciones por fila dentro del modal.
- Eliminar fondo: accion `Eliminar` por fila (solo si no tiene movimientos que lo impidan).
- La visibilidad de un fondo a propietarios se controla desde la configuracion del fondo.

### Inmuebles (`/inmuebles`) [JUNTA]
- Crear inmueble: boton `+ Crear Inmueble`.
- Carga masiva: boton `Carga Masiva` en cabecera.
- Acciones por fila: `Editar datos`, `Agregar Residente`, `Agregar Co-propietarios`, `Eliminar`.
- Un inmueble no se puede eliminar si ya tiene avisos o recibos generados.

### Zonas / Areas (`/zonas`) [JUNTA]
Se presentan como "Areas / Sectores" en la interfaz.
- Crear: boton `+ Crear Area / Sector`.
- Editar: icono lapiz por tarjeta.
- Eliminar: icono basurero (solo si no tiene historial contable).

### Junta General (`/junta-general`) [JUNTA] [JUNTA_GENERAL]
- Registrar junta individual vinculada: bloque `Registrar Junta Individual`.
- Ver estado de cuenta por junta: tabla `Estado de Cuenta por Junta`.
- Conciliacion por periodo: filtro de mes, junta y estado.
- Gestionar vinculaciones: acciones `Editar`, `Codigo`, `Eliminar vinculo`.
- Si una junta ya tiene historial en aviso de cobro, queda bloqueada para editar o eliminar su vinculo.

### Alquileres - Junta (`/alquileres`) [JUNTA]
- Tabs: `Espacios` / `Solicitudes`.
- Crear amenidad o espacio: boton `+ Nuevo Alquiler` en tab Espacios.
- Editar o activar espacio: acciones por tarjeta de amenidad.
- Solicitudes: aprobar o rechazar desde acciones de cada solicitud.

### Alquileres - Propietario (`/propietario/alquileres`) [PROPIETARIO]
- Tabs: `Espacios` / `Ver Solicitudes`.
- Reservar espacio: boton `Reservar` en tarjeta de espacio disponible.
- Ver mis reservas: tab `Ver Solicitudes`.
- Reportar pago de reserva: accion `Reportar pago` en la solicitud.

### Encuestas - Junta (`/carta-consulta`) [JUNTA]
- Crear encuesta: boton `+ Nueva Carta`.
- Tipos disponibles: Si/No, Opcion Multiple, Respuesta Abierta.
- Acciones por encuesta: `Ver Resultados`, `Editar`, `Cerrar`, `Eliminar`.

### Encuestas - Propietario (`/mis-cartas-consulta`) [PROPIETARIO]
- Votar en encuesta activa: boton `Votar`.
- Ver resultados (si ya voto o encuesta cerrada): boton `Ver Resultados`.

### Proveedores (`/proveedores`) [JUNTA]
- Crear proveedor: boton `+ Nuevo Proveedor`.
- Carga masiva: boton `Carga Masiva`.
- Acciones por fila: `Ver detalles`, `Editar datos`, `Eliminar`.

### Perfil del Condominio (`/perfil`) [JUNTA]
- Editar informacion legal y datos del administrador.
- Subir logos (principal, condominio, firma).
- Configurar mensajes de avisos de cobro (4 mensajes personalizables).
- Cambiar contrasena: boton `Cambiar Contrasena`.

### Perfil del Propietario (`/propietario/perfil`) [PROPIETARIO]
- Editar datos personales.
- Cambiar contrasena.

### Notificaciones (`/propietario/notificaciones`) [PROPIETARIO]
El propietario ve aqui notificaciones del condominio y acciones relacionadas con su cuenta.

---

## 5) Flujos operativos

### Registrar un gasto [JUNTA]
1. Ir a `/gastos`.
2. Hacer clic en `+ Nuevo Gasto`.
3. Completar tipo, distribucion, monto en Bs, tasa y soportes.
4. Guardar. El gasto queda visible en el listado y en el preliminar del proximo cierre.
5. Si se requiere pagar al proveedor de inmediato, usar `Pagar Proveedor` desde el menu de acciones (no depende de que exista aviso de cobro).

### Cerrar ciclo y generar avisos [JUNTA]
1. Ir a `/cierres`.
2. Revisar el preliminar del periodo (gastos incluidos y distribucion).
3. Ejecutar `Cerrar Ciclo`.
4. El sistema genera avisos de cobro inmutables para cada propietario.
5. Confirmar los avisos en `/avisos-cobro`.

### Registrar pago de propietario [AMBOS]
- Junta: desde `/cuentas-cobrar`, boton `Registrar Pago` por fila de inmueble.
- Propietario: desde `/propietario/estado-cuenta` o `/propietario/recibos`.
- El pago ingresa como pendiente de aprobacion.
- La junta lo aprueba o rechaza desde `/cuentas-cobrar` en la seccion de pendientes.

### Aprobar o rechazar pago de propietario [JUNTA]
1. Ir a `/cuentas-cobrar`.
2. Revisar seccion de pagos pendientes de aprobacion.
3. Aprobar o rechazar con las acciones disponibles por fila.

### Ajuste de saldo en cobranza [JUNTA]
Existen dos modos:
- `COMPLETO` (desde `/cuentas-cobrar`): puede ir a favor del propietario hacia cuenta bancaria o gasto extra. Impacta la contabilidad bancaria.
- `SOLO_INMUEBLE` (desde el modal de estado de cuenta del inmueble): impacta solo el saldo del inmueble. No crea movimientos bancarios ni modifica fondos.

### Revertir un movimiento [JUNTA]
1. Ir a `/estado-cuentas`.
2. Ubicar el movimiento (pago, ajuste, transferencia, egreso o pago a proveedor).
3. En la columna `Acciones`, usar el boton `Revertir`.
4. Confirmar. La reversion cancela el movimiento respetando trazabilidad.

### Pagar proveedor sin aviso generado [JUNTA]
1. Ir a `/gastos`.
2. En el menu de acciones del gasto, seleccionar `Pagar Proveedor`.
3. Si el gasto no esta aun en avisos de cobro, aparece una confirmacion previa que indica que el pago afectara el estado de cuenta bancario de inmediato.
4. Confirmar. El impacto contable es inmediato.
5. El gasto sigue su ciclo normal para ser cobrado a los propietarios en el proximo cierre.

### Reservar una amenidad [PROPIETARIO]
1. Ir a `/propietario/alquileres`.
2. En el tab `Espacios`, seleccionar el espacio disponible y hacer clic en `Reservar`.
3. Completar el formulario de reserva.
4. Una vez aprobada, reportar el pago con `Reportar pago` en tab `Ver Solicitudes`.

### Crear una encuesta / carta consulta [JUNTA]
1. Ir a `/carta-consulta`.
2. Hacer clic en `+ Nueva Carta`.
3. Seleccionar tipo: Si/No, Opcion Multiple o Respuesta Abierta.
4. Configurar opciones y publicar.
5. Los propietarios pueden responder desde `/mis-cartas-consulta`.

---

## 6) Preguntas frecuentes

### ¿Que es un cierre mensual?
El cierre mensual es el proceso mediante el cual la junta consolida todos los gastos del periodo, los distribuye entre los propietarios segun su alicuota o por partes iguales, y genera los avisos de cobro. Una vez ejecutado, los avisos son inmutables (no se pueden modificar).

### ¿Que es un aviso de cobro?
Es el documento que resume lo que cada propietario debe pagar en un periodo. Se genera automaticamente al cerrar el ciclo mensual. Incluye gastos comunes, individuales y saldos anteriores. El propietario lo ve en `/propietario/recibos`.

### ¿Que es la alicuota?
La alicuota es el porcentaje de participacion de cada inmueble en los gastos comunes del condominio. Se configura al registrar el inmueble y determina cuanto paga cada propietario de los gastos distribuidos.

### ¿Que es un fondo?
Un fondo es una subdivision contable dentro de una cuenta bancaria. Permite organizar el dinero por proposito (reserva, mantenimiento, administracion, etc.). Cada cuenta bancaria puede tener uno o mas fondos.

### ¿Que pasa si un propietario no paga?
El saldo pendiente del propietario se acumula en su estado de cuenta y aparece como deuda en el proximo aviso de cobro. La junta puede ver los deudores desde `/cuentas-cobrar` en el tab `Deudores`.

### ¿Como se distribuyen los gastos entre propietarios?
Existen dos metodos de distribucion configurables desde `/cierres`:
- Por alicuota: cada propietario paga segun su porcentaje de participacion.
- Por partes iguales: todos pagan el mismo monto.

### ¿Que es un ajuste de saldo?
Es una correccion manual al saldo de un propietario. Puede ser a favor (descuento o credito) o en contra (cargo adicional). Existen dos tipos: COMPLETO (afecta contabilidad bancaria) y SOLO_INMUEBLE (solo afecta el estado de cuenta del inmueble).

### ¿Se puede revertir un pago ya validado?
Si, desde `/estado-cuentas` usando el boton `Revertir` en el movimiento correspondiente. Solo aplica si el pago esta en estado Validado y cumple las validaciones de trazabilidad del sistema.

### ¿Donde ve el propietario sus deudas?
En `/propietario/estado-cuenta` (resumen general) y en `/propietario/estado-cuenta-inmueble` (detalle por inmueble).

### ¿Puede un propietario registrar su propio pago?
Si. El propietario puede registrar pagos desde su estado de cuenta o recibos. El pago entra como pendiente de aprobacion y la junta debe validarlo desde `/cuentas-cobrar`.

### ¿Que puede ver la Junta General?
La Junta General solo puede ver las juntas individuales que tiene vinculadas, el estado de cuenta entre ellas y la conciliacion de gastos distribuidos. No puede ver propietarios, inmuebles ni detalles internos de ninguna junta individual.

### ¿Como se registra una nueva junta de condominio en la plataforma?
Desde la pagina publica `/registro-junta` se puede registrar una nueva junta. Este proceso es publico y no requiere autenticacion.

---

## 7) Restricciones importantes

- Los datos de cada condominio estan completamente aislados (multitenancy).
- Los avisos de cobro generados en el cierre son snapshots inmutables: no se pueden editar despues.
- Los ajustes `SOLO_INMUEBLE` no afectan el libro mayor ni los fondos bancarios.
- Un pago solo puede revertirse si esta en estado `Validado` y no tiene recibo asociado con restricciones.
- Zonas con historial contable no permiten cambios estructurales en los inmuebles vinculados.
- Fondos con movimientos registrados no se pueden eliminar sin cumplir validaciones.
- La Junta General no puede ver ni gestionar inmuebles individuales.
- La Junta General no puede acceder a modulos exclusivos de las juntas individuales.
- Un inmueble no se puede eliminar si ya tiene avisos o recibos generados.

---

## 8) Estado Junta General (al 2026-04-03)

### Completado
- Sprint 1: registro desde soporte, migracion legacy, jerarquia base y bloqueo de inmuebles para Junta General.
- Sprint 1 (extra): flujo operativo publico de registro en `/registro-junta`.
- Sprint 2: CRUD miembros, codigos de invitacion, aceptar invitacion, estados de vinculacion y validaciones de RIF.
- Sprint 3: cierre y distribucion General -> Individual con trazabilidad, miembros fantasma y UX de preliminar/cierre.
- Sprint 4: conciliacion, estado de cuenta General<->Individual, pagos a Junta General como proveedor y filtros.
- Sprint 5 (parcial): reglas 1:1 editar/eliminar por historial, endurecimiento de permisos jerarquicos, auditoria de vinculacion y notificaciones ampliadas.

### Pendiente
- Sprint 5: completar cobertura total de permisos, auditoria y notificaciones en todos los modulos.
- Sprint 6: pruebas automatizadas, QA formal, manual operativo y despliegue/rollback.
