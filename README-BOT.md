# Habioo - Documentacion Funcional y Guias de Accion

Documento de referencia para la plataforma de gestion de condominios Habioo.
Sirve como guia para agentes de IA que asisten a usuarios en navegar y operar el sistema.

- Ultima actualizacion: 2026-03-23
- Stack: React + Vite + Tailwind (frontend), Node/Express + PostgreSQL (backend)

---

## Leyenda de roles

Cada accion esta etiquetada con el rol que puede ejecutarla:

- `[JUNTA]` — Solo la Junta / Administrador del condominio
- `[PROPIETARIO]` — Solo el Propietario o Inquilino
- `[AMBOS]` — Disponible para ambos roles (con alcance diferente segun el rol)

---

## INDICE

1. [Estructura de navegacion](#1-estructura-de-navegacion)
2. [Roles de usuario](#2-roles-de-usuario)
3. [Guias de accion - Junta de Condominio](#3-guias-de-accion---junta-de-condominio)
4. [Guias de accion - Propietario / Inquilino](#4-guias-de-accion---propietario--inquilino)
5. [Reglas y restricciones del sistema](#5-reglas-y-restricciones-del-sistema)
6. [Referencia tecnica (rutas y endpoints)](#6-referencia-tecnica-rutas-y-endpoints)
7. [Modelo de datos](#7-modelo-de-datos)
8. [Modelo organizacional](#8-modelo-organizacional)
9. [Ejecucion local](#9-ejecucion-local)

---

## 1. Estructura de navegacion

El menu lateral organiza las secciones en dos grupos:

### Contabilidad
- **Dashboard** -> `/dashboard` — Centro de mando con KPIs y movimientos recientes `[JUNTA]`
- **Gastos** -> `/gastos` — Registro y gestion de gastos del condominio `[AMBOS]`
- **Cierres** -> `/cierres` — Cierre de ciclo mensual y generacion de avisos de cobro `[JUNTA]`
- **Avisos de Cobro** -> `/avisos-cobro` — Historial de avisos/recibos emitidos `[AMBOS]`
- **Cuentas por Cobrar** -> `/cuentas-cobrar` — Deuda de propietarios y registro de pagos `[JUNTA]`
- **Estado de Cuentas** -> `/estado-cuentas` — Libro mayor bancario por cuenta/fondo `[JUNTA]`

### Configuracion
- **Bancos** -> `/bancos` — Cuentas bancarias y fondos virtuales `[JUNTA]`
- **Proveedores** -> `/proveedores` — Directorio de proveedores del condominio `[JUNTA]`
- **Inmuebles** -> `/inmuebles` — Propiedades, propietarios e inquilinos `[JUNTA]`
- **Zonas** -> `/zonas` — Areas o sectores del condominio `[JUNTA]`

### Perfil
- **Perfil del Condominio** -> `/perfil` — Datos del condominio `[JUNTA]`
- **Mi Perfil** -> perfil personal del usuario `[AMBOS]`

---

## 2. Roles de usuario

### Junta de Condominio `[JUNTA]`
- Acceso completo a todas las secciones
- Puede crear, editar y eliminar: gastos, proveedores, propiedades, bancos, fondos, zonas
- Puede generar avisos de cobro (cierres mensuales)
- Puede aprobar o rechazar pagos enviados por propietarios
- Puede registrar pagos directamente sobre cualquier propiedad
- Puede registrar pagos a proveedores y transferencias entre fondos

### Propietario / Inquilino `[PROPIETARIO]`
- Solo ve informacion de su(s) propia(s) propiedad(es)
- Puede ver su estado de cuenta, sus recibos y los gastos que lo afectan
- Puede registrar pagos (quedan en cola de aprobacion hasta que la junta los valide)
- Puede editar su propio perfil de contacto
- No puede modificar ningun dato administrativo

---

## 3. Guias de accion - Junta de Condominio

---

### 3.1 Gastos

#### `[JUNTA]` Como agregar un gasto
1. Ir al menu lateral -> **Gastos**
2. Hacer clic en el boton **+ Nuevo Gasto** (boton verde, parte superior derecha)
3. Completar el formulario en el modal:
   - **Proveedor**: seleccionar de la lista desplegable
   - **Concepto**: descripcion del gasto (ej: "Mantenimiento ascensor")
   - **Numero de Documento**: numero de factura o referencia
   - **Monto en BS**: monto total de la factura en bolivares
   - **Tasa de Cambio**: se puede ingresar manualmente o hacer clic en **"Obtener tasa BCV"** para autocompletar
   - **Equivalente USD**: se calcula automaticamente
   - **Clasificacion**: seleccionar **Fijo** (gasto recurrente mensual) o **Variable** (gasto puntual)
   - **Asignacion Tipo**: define a quienes impacta este gasto:
     - **Comun**: se reparte entre todos los inmuebles segun alicuota o partes iguales
     - **Zona**: solo impacta los inmuebles de una area/sector especifico (se debe seleccionar la zona)
     - **Individual**: solo impacta un inmueble especifico (se debe seleccionar la propiedad)
     - **Extra**: gasto extraordinario no periodico
   - **Total de Cuotas**: cuantos meses se va a diferir el gasto (1 a 24 cuotas)
   - **Fecha del Gasto**: fecha de la factura
   - **Nota**: campo opcional para observaciones
   - **Factura**: adjuntar imagen de la factura principal (opcional)
   - **Soportes Adicionales**: adjuntar imagenes adicionales (opcional)
4. Hacer clic en **Guardar Gasto**

#### `[JUNTA]` Como ver y filtrar gastos
1. Ir a **Gastos**
2. Usar el campo **"Buscar concepto, proveedor..."** para buscar por texto
3. Usar los campos **Desde** y **Hasta** para filtrar por rango de fechas
4. Usar las pestanas: **Todos | Comunes | Por Areas / Sectores | Individuales | Extra**
5. Hacer clic en el nombre de la columna para ordenar
6. Hacer doble clic en una fila para ver los detalles del gasto

#### `[JUNTA]` Como eliminar un gasto
1. Ir a **Gastos**
2. Hacer clic en el icono de acciones de la fila del gasto
3. Seleccionar **Eliminar**
4. Confirmar en el modal de confirmacion haciendo clic en **Eliminar**
> **Restriccion**: un gasto solo se puede eliminar si todas sus cuotas tienen estado "Pendiente" (no ha sido incluido en ningun aviso de cobro).

---

### 3.2 Cierres (Generar avisos de cobro)

#### `[JUNTA]` Como ver la preliminar del cierre mensual
1. Ir al menu lateral -> **Cierres**
2. La pagina muestra el periodo actual (mes y ano)
3. Se visualiza la simulacion de cuanto le corresponde pagar a cada inmueble segun los gastos del ciclo

#### `[JUNTA]` Como generar el aviso de cobro (cerrar el mes)
1. Ir a **Cierres**
2. Verificar la preliminar con los gastos del periodo
3. Si se desea cambiar el metodo de division, hacer clic en **"Cambiar metodo de division"** (alicuota o partes iguales)
4. Hacer clic en **"Generar Aviso de Cobro (Cierre)"**
5. Confirmar la accion
> **Restriccion**: solo se pueden cerrar meses pasados, no el mes en curso ni meses futuros.
> **Efecto**: al cerrar, se generan recibos individuales para cada inmueble y se congela el estado del aviso (inmutable).

#### `[JUNTA]` Como cambiar el metodo de division de gastos
1. Ir a **Cierres**
2. Hacer clic en **"Cambiar metodo de division"**
3. Seleccionar **Alicuota** (proporcional al porcentaje de cada inmueble) o **Partes Iguales**
4. Guardar los cambios

---

### 3.3 Avisos de Cobro

#### `[JUNTA]` Como ver el historial de avisos (todos los inmuebles)
1. Ir al menu lateral -> **Avisos de Cobro**
2. La tabla muestra todos los recibos emitidos con: fecha, mes de cobro, inmueble, propietario, monto, estado
3. Filtrar por:
   - Texto libre (inmueble o propietario)
   - **Desde / Hasta** (rango de fechas)
   - **Estado**: Todos | Pagados | Abonado | Pendiente

#### `[JUNTA]` Como ver o imprimir un aviso de cobro
1. Ir a **Avisos de Cobro**
2. Hacer clic en el boton de impresion en la columna Acciones de la fila
3. Se abre el modal **Vista Aviso de Cobro** con el detalle completo
4. Hacer clic en **Imprimir** para abrir el dialogo de impresion del navegador
5. Opcionalmente hacer clic en **Descargar PDF** o **Enviar por Correo**

---

### 3.4 Cuentas por Cobrar

#### `[JUNTA]` Como ver la deuda de los propietarios
1. Ir al menu lateral -> **Cuentas por Cobrar**
2. Por defecto se muestra la pestana **Deudores** (solo inmuebles con saldo pendiente > 0)
3. Cambiar a pestana **Todos** para ver todos los inmuebles sin filtro de deuda

#### `[JUNTA]` Como registrar un pago de propietario (desde admin)
1. Ir a **Cuentas por Cobrar**
2. En la fila del inmueble, abrir el menu de acciones y seleccionar **"Registrar pago"**
3. Completar el modal:
   - **Monto a Pagar**: monto recibido
   - **Moneda de Pago**: BS o USD
   - **Tasa BCV**: si paga en BS, ingresar la tasa o hacer clic en **"Obtener tasa actual"**
   - **Metodo de Pago**: Transferencia | Pago Movil | Zelle | Efectivo | Deposito | Credito
   - **Referencia/Transaccion**: numero de referencia del pago
   - **Fecha de Pago**: fecha en que se recibio el pago
   - **Nota**: observacion opcional
4. Hacer clic en **"Registrar Pago"**
> El pago queda en estado **"PendienteAprobacion"** hasta que sea validado.

#### `[JUNTA]` Como aprobar o rechazar un pago pendiente
1. Ir a **Cuentas por Cobrar**
2. En la seccion **"Pagos Pendientes de Aprobacion"**, ver la lista de pagos en espera
3. Hacer clic en **Aprobar** para validar el pago (se aplica al saldo del inmueble)
4. Hacer clic en **Rechazar** para rechazarlo (con trazabilidad)

#### `[JUNTA]` Como ver el estado de cuenta de un inmueble (desde admin)
1. Ir a **Cuentas por Cobrar**
2. En la fila del inmueble, abrir el menu de acciones y seleccionar **"Ver estado de cuenta"**
3. Se abre el modal con el historial completo de movimientos del inmueble
4. Filtrar por **Desde / Hasta** si se desea un rango especifico

---

### 3.5 Estado de Cuentas Bancarias

#### `[JUNTA]` Como ver los movimientos de una cuenta bancaria
1. Ir al menu lateral -> **Estado de Cuentas**
2. Seleccionar la cuenta bancaria o fondo del selector/pestanas
3. La tabla muestra: fecha, tipo de movimiento, concepto, monto, saldo acumulado
4. Filtrar por rango de fechas (**Desde / Hasta**) o por tipo de movimiento

#### `[JUNTA]` Como registrar un pago a proveedor
1. Ir a **Estado de Cuentas**
2. En el boton de acciones, seleccionar **"Pago a Proveedor"**
3. Seleccionar el gasto/factura a pagar, el monto y la cuenta bancaria desde la que se debita
4. Confirmar la operacion

#### `[JUNTA]` Como registrar una transferencia entre fondos
1. Ir a **Estado de Cuentas**
2. Hacer clic en **"Transferencia entre fondos"**
3. Seleccionar fondo origen, fondo destino y monto
4. Confirmar la transferencia

#### `[JUNTA]` Como revertir un pago registrado por error (boton "Revertir 48h")
1. Ir al menu lateral -> **Estado de Cuentas**
2. Seleccionar la cuenta bancaria donde aparece el ingreso erroneo
3. En la tabla de movimientos, localizar la fila del pago a revertir
4. Hacer clic en el boton **"Revertir (48h)"** (color ambar) en la columna de acciones
5. Confirmar la accion en el dialogo de confirmacion
> **El sistema deshace automaticamente**: el ingreso en los fondos, los movimientos registrados y el ajuste en el saldo del inmueble.

> **Restricciones del boton Revertir**:
> - Solo disponible para el rol Administrador (`[JUNTA]`)
> - Solo aparece en movimientos de tipo INGRESO vinculados a un pago de propietario
> - El pago debe estar en estado **Validado**
> - Solo es posible dentro de las **48 horas** siguientes al registro del pago
> - Si el pago tenia un `recibo_id` directo asignado, se bloquea (usar ajuste manual)
> - Si el pago ya impacto avisos/recibos de cobro de ese inmueble, el sistema revierte tambien los recibos y gastos correspondientes de forma automatica

---

### 3.6 Bancos y Fondos

#### `[JUNTA]` Como agregar una cuenta bancaria
1. Ir al menu lateral -> **Bancos** (seccion Configuracion)
2. Hacer clic en **"+ Nueva Cuenta"**
3. Completar el modal:
   - **Tipo de Pago**: Transferencia | Pago Movil | Zelle | Efectivo BS | Efectivo USD | Efectivo
   - **Moneda**: BS o USD (se bloquea automaticamente segun el tipo)
   - **Nombre del Banco**: nombre de la institucion
   - **Apodo**: nombre corto para identificarla en el sistema
   - **Nombre del Titular**: nombre completo del titular de la cuenta
   - **Cedula/RIF del Titular**: documento de identidad del titular
   - Campos adicionales segun tipo:
     - **Transferencia/Pago Movil**: Numero de Cuenta, si acepta Transferencia, si acepta Pago Movil (con telefono y cedula)
     - **Zelle**: Email para Zelle, telefono opcional
4. Hacer clic en **"Guardar Cuenta"**

#### `[JUNTA]` Como editar una cuenta bancaria
1. Ir a **Bancos**
2. En la fila de la cuenta, abrir el menu de acciones y seleccionar **"Editar cuenta"**
3. Modificar los campos necesarios
4. Hacer clic en **"Actualizar Cuenta"**

#### `[JUNTA]` Como eliminar una cuenta bancaria
1. Ir a **Bancos**
2. En la fila de la cuenta, abrir el menu y seleccionar **"Eliminar"**
3. Confirmar la eliminacion

#### `[JUNTA]` Como ver y gestionar los fondos de una cuenta
1. Ir a **Bancos**
2. En la fila de la cuenta, hacer clic en **"Ver fondos"**
3. Se abre el modal de fondos con la lista de fondos virtuales asociados a esa cuenta
4. Cada fondo muestra: nombre, moneda, saldo actual, si es operativo, porcentaje asignado, visibilidad para propietarios

#### `[JUNTA]` Como agregar un fondo virtual
1. Ir a **Bancos** -> **"Ver fondos"** de la cuenta deseada
2. Hacer clic en **"+ Nuevo Fondo"**
3. Completar:
   - **Nombre**: nombre descriptivo del fondo (ej: "Fondo de Reserva", "Operaciones")
   - **Moneda**: BS o USD
   - **Es Operativo**: si este fondo se usa para pagos operativos del dia a dia
   - **Porcentaje Asignacion**: que porcentaje de los ingresos se destina automaticamente a este fondo
   - **Visible a Propietarios**: si los propietarios pueden ver el saldo de este fondo en su portal
   - **Saldo Inicial**: saldo de arranque (opcional, por defecto cero)
4. Hacer clic en **"Guardar Fondo"**

#### `[JUNTA]` Como eliminar un fondo
1. Ir a **Bancos** -> **"Ver fondos"**
2. En la fila del fondo, hacer clic en el icono de eliminar
> **Restriccion**: solo se puede eliminar si no tiene movimientos registrados.

---

### 3.7 Proveedores

#### `[JUNTA]` Como agregar un proveedor
1. Ir al menu lateral -> **Proveedores** (seccion Configuracion)
2. Hacer clic en **"+ Nuevo Proveedor"**
3. Completar el modal:
   - **Identificador (RIF)**: formato V/E/J/G seguido de numeros (requerido)
   - **Nombre**: nombre del proveedor (requerido, se autocapitaliza)
   - **Email**: correo electronico (opcional, validado)
   - **Rubro**: categoria del proveedor (ej: Electricistas, Seguridad) (opcional)
   - **Telefono Principal**: numero de contacto (requerido, solo numeros)
   - **Telefono Secundario**: numero alternativo (opcional)
   - **Estado de Venezuela**: estado donde opera (requerido)
   - **Direccion**: direccion completa (requerida)
4. Hacer clic en **"Guardar Proveedor"**

#### `[JUNTA]` Como editar un proveedor
1. Ir a **Proveedores**
2. En la fila del proveedor, hacer clic en el menu **"Opciones"** y seleccionar **"Editar datos"**
3. Modificar los campos y hacer clic en **"Actualizar Proveedor"**

#### `[JUNTA]` Como eliminar un proveedor
1. Ir a **Proveedores**
2. En la fila del proveedor, hacer clic en el menu **"Opciones"** y seleccionar **"Eliminar"**
3. Confirmar la eliminacion
> Nota: el borrado es logico (el proveedor se desactiva pero no se borra de la base de datos).

#### `[JUNTA]` Como cargar proveedores en lote (carga masiva)
1. Ir a **Proveedores**
2. Hacer clic en **"Carga masiva"**
3. Hacer clic en **"Descargar Plantilla"** para obtener el archivo Excel con el formato correcto
4. Llenar la plantilla con los datos de los proveedores
5. Hacer clic en **"Seleccionar archivo Excel"** y cargar el archivo completado
6. El sistema valida cada fila y muestra errores en rojo y validas en verde
7. Si hay errores, corregir el archivo y volver a cargarlo
8. Hacer clic en **"Importar"** para confirmar la importacion

#### `[JUNTA]` Como buscar un proveedor
1. Ir a **Proveedores**
2. Usar el campo **"Buscar por nombre, RIF, correo o rubro..."**
3. La lista se filtra en tiempo real

---

### 3.8 Inmuebles (Propiedades)

#### `[JUNTA]` Como agregar un inmueble
1. Ir al menu lateral -> **Inmuebles** (seccion Configuracion)
2. Hacer clic en **"+ Nueva Propiedad"**
3. Completar el formulario por secciones:

   **Identificador y Alicuota**
   - **Identificador**: codigo o nombre del inmueble (ej: "4B", "Casa 12", "Local 3") (requerido)
   - **Alicuota**: porcentaje o fraccion de participacion del inmueble (requerido)

   **Propietario**
   - Seleccionar si es **"Crear propietario nuevo"** o **"Seleccionar propietario existente"**
   - Si es nuevo: Cedula (V/E + numeros), Nombre, Correo Electronico, Correo Secundario (opcional), Telefono Principal, Telefono Secundario (opcional), Contrasena (autogenerada, editable)

   **Inquilino (opcional)**
   - Activar la casilla **"Tiene Inquilino"** si aplica
   - Completar: Cedula, Nombre, Correo, Telefono
   - Activar **"Permitir acceso al portal"** si el inquilino puede iniciar sesion

   **Saldo Inicial**
   - **Saldo inicial CERO**: no tiene deuda pendiente al ingresar al sistema
   - **Saldo inicial en BS**: ingresar el monto en BS y la tasa BCV para registrar una deuda inicial

   **Deudas Iniciales (opcional)**
   - Activar **"Tiene deudas iniciales"** para registrar conceptos de deuda previos al sistema
   - Agregar filas con: Concepto, Monto de Deuda, Monto Abonado
   - Usar **"Agregar fila"** para agregar mas conceptos

4. Hacer clic en **"Guardar Propiedad"**

#### `[JUNTA]` Como editar un inmueble
1. Ir a **Inmuebles**
2. En la fila del inmueble, abrir el menu de acciones y seleccionar **"Editar datos"**
3. Modificar los campos y hacer clic en **"Actualizar Propiedad"**

#### `[JUNTA]` Como eliminar un inmueble
1. Ir a **Inmuebles**
2. En la fila del inmueble, abrir el menu y seleccionar **"Eliminar"**
3. Confirmar la eliminacion
> **Restriccion**: solo se puede eliminar si el inmueble NO tiene avisos de cobro ni recibos generados.

#### `[JUNTA]` Como hacer un ajuste de saldo en un inmueble
1. Ir a **Inmuebles**
2. En la fila del inmueble, abrir el menu y seleccionar **"Ajuste de saldo"**
3. En el modal:
   - **Monto**: monto del ajuste
   - **Tipo de Ajuste**: a favor (abono) o en contra (cargo)
   - **Nota**: razon del ajuste (requerida)
4. Hacer clic en **"Guardar Ajuste"**
> **Nota**: los ajustes de saldo solo afectan el estado de cuenta del inmueble, NO impactan las cuentas bancarias ni los fondos.

#### `[JUNTA]` Como ver el estado de cuenta de un inmueble (desde admin)
1. Ir a **Inmuebles**
2. En la fila del inmueble, abrir el menu y seleccionar **"Ver estado de cuenta"**
3. Se abre el modal con el historial completo: fecha, tipo de movimiento, concepto, cargo, abono, saldo acumulado
4. Opcionalmente filtrar por rango de fechas o descargar el estado de cuenta

#### `[JUNTA]` Como cargar inmuebles en lote (carga masiva)
1. Ir a **Inmuebles**
2. Hacer clic en el boton de carga masiva (icono Excel o similar)
3. Descargar la plantilla, llenar con los datos y subir el archivo
4. Verificar la validacion de cada fila y confirmar la importacion
> **Nota**: la carga masiva importa la estructura y saldos base, pero NO genera avisos de cobro automaticamente.

---

### 3.9 Zonas (Areas / Sectores)

#### `[JUNTA]` Como crear una zona o area
1. Ir al menu lateral -> **Zonas** (seccion Configuracion)
2. Hacer clic en **"+ Crear Area / Sector"**
3. Completar el modal:
   - **Nombre del Area / Sector**: nombre descriptivo (ej: "Torre A", "Locales Comerciales", "Estacionamientos")
   - **Inmuebles en esta area / sector**: seleccionar con casillas los inmuebles que pertenecen a esta zona
4. Hacer clic en **"Crear Area / Sector"**

#### `[JUNTA]` Como editar una zona
1. Ir a **Zonas**
2. Hacer clic en el icono de edicion (lapiz) de la tarjeta de la zona
3. Modificar el nombre o la lista de inmuebles
4. Hacer clic en **"Guardar Cambios"**
> **Restriccion**: si la zona ya tiene gastos asociados, la estructura de inmuebles queda bloqueada. Solo se puede cambiar el nombre o activar/desactivar la zona.

#### `[JUNTA]` Como desactivar o activar una zona
1. Ir a **Zonas**
2. Si la zona tiene gastos, aparece el icono de activar/desactivar (no el de eliminar)
3. Hacer clic en el icono correspondiente (⛔ para desactivar, ✅ para activar)

#### `[JUNTA]` Como eliminar una zona
1. Ir a **Zonas**
2. Si la zona NO tiene gastos, aparece el icono de eliminar (basurero)
3. Hacer clic en el icono y confirmar

---

### 3.10 Perfil del Condominio

#### `[JUNTA]` Como actualizar los datos del condominio
1. Ir al menu lateral -> **Perfil** (o icono de configuracion en la esquina)
2. Modificar los campos: Nombre, RIF, Direccion, Ciudad/Estado, Telefono, Email Principal, Email Secundario
3. Hacer clic en **"Guardar Cambios"**

---

## 4. Guias de accion - Propietario / Inquilino

---

### `[PROPIETARIO]` 4.1 Ver mi estado de cuenta
1. Al iniciar sesion, ir a la vista de estado de cuenta del inmueble
2. Se muestra un resumen de saldo (en BS y USD) con boton para consultar la tasa BCV
3. La vista dia a dia muestra cada movimiento con su saldo acumulado
4. Cambiar a la vista de **"Cortes por Aviso"** para ver el historico por mes:
   - Seleccionar el ano y mes del corte a consultar
   - Se muestra el estado del fondo en ese periodo especifico

### `[PROPIETARIO]` 4.2 Ver mis recibos / avisos de cobro
1. Ir a la seccion de recibos del portal del propietario
2. La lista muestra todos los avisos emitidos con: fecha, mes, monto, estado (Pagado/Abonado/Pendiente)
3. Filtrar por estado si se desea
4. Hacer clic en el boton de impresion para ver el detalle del aviso o descargarlo

### `[PROPIETARIO]` 4.3 Ver los gastos del condominio (solo lectura)
1. Ir a la seccion de gastos
2. Se muestran los gastos que aplican a mi inmueble con el monto correspondiente segun alicuota
3. Buscar por concepto o filtrar por fecha
4. No es posible crear, editar ni eliminar gastos desde el portal del propietario

### `[PROPIETARIO]` 4.4 Registrar un pago
1. En el estado de cuenta o en la lista de cuentas por cobrar, hacer clic en **"Registrar Pago"**
2. Completar el modal:
   - **Monto**: monto pagado
   - **Moneda**: BS o USD
   - **Tasa BCV**: si aplica
   - **Metodo de Pago**: forma en que se realizo el pago
   - **Referencia/Transaccion**: numero de referencia
   - **Fecha de Pago**: fecha en que se realizo
   - **Nota**: observacion opcional
3. Hacer clic en **"Registrar Pago"**
> **Nota importante**: el pago queda en estado **"Pendiente de Aprobacion"** hasta que la junta de condominio lo revise y apruebe. No se aplica al saldo de inmediato.

### `[PROPIETARIO]` 4.5 Ver las notificaciones
1. Acceder al icono de notificaciones (campana) en la barra superior
2. Se muestran: recordatorios de pago, confirmaciones de pago aprobado/rechazado, alertas del sistema

### `[AMBOS]` 4.6 Editar mi perfil personal
1. Ir a la seccion de perfil del usuario
2. Modificar datos de contacto: nombre, telefono, correo
3. Para cambiar la contrasena, ir a la opcion de cambio de contrasena e ingresar la contrasena actual y la nueva
4. Guardar los cambios

---

## 5. Reglas y restricciones del sistema

### Gastos `[JUNTA]`
- Un gasto solo se puede eliminar si TODAS sus cuotas tienen estado "Pendiente"
- Los gastos de tipo "Extra" no se incluyen en el ciclo de cierre regular
- La tasa de cambio debe tener 3 decimales
- El monto equivalente USD se calcula automaticamente: Monto BS / Tasa

### Cierres y Avisos `[JUNTA]`
- Solo se pueden cerrar meses pasados, nunca el mes en curso ni meses futuros
- Una vez emitido un aviso, es INMUTABLE (el estado queda congelado en un snapshot)
- No se puede modificar ni regenerar un aviso ya emitido

### Propiedades `[JUNTA]`
- No se puede eliminar un inmueble si tiene avisos o recibos generados
- Los ajustes de saldo en inmuebles NO afectan cuentas bancarias ni fondos
- La alicuota de cada inmueble determina la proporcion del gasto comun que le corresponde

### Pagos de propietarios `[AMBOS]`
- Todo pago registrado por un propietario `[PROPIETARIO]` pasa a cola de aprobacion ("PendienteAprobacion")
- La junta `[JUNTA]` debe aprobar o rechazar cada pago con trazabilidad
- Al aprobar, el saldo del inmueble se actualiza y los fondos bancarios reciben el ingreso

### Reversion de pagos (rollback) `[JUNTA]`
- Un pago validado puede revertirse desde **Estado de Cuentas** usando el boton **"Revertir (48h)"**
- La ventana de reversion es de exactamente **48 horas** desde el momento en que se registro el pago
- El rollback deshace: fondos, movimientos de fondos, saldo del inmueble, y si el pago impacto recibos/gastos, los revierte tambien automaticamente mediante simulacion FIFO
- No es posible revertir si: el pago tiene un recibo directamente asignado (`recibo_id`), o si la ventana de 48 horas ya expiro
- Para pagos fuera de la ventana o con trazabilidad contable compleja, usar **ajuste manual de saldo**

### Zonas `[JUNTA]`
- Si una zona ya tiene gastos asociados, no se pueden cambiar los inmuebles que la componen
- Solo se puede cambiar el nombre o activar/desactivar la zona

### Fondos `[JUNTA]`
- No se puede eliminar un fondo si tiene movimientos registrados
- La visibilidad de cada fondo para propietarios se controla individualmente
- Solo los fondos marcados como "Visible a Propietarios" aparecen en el portal del propietario `[PROPIETARIO]`

### Proveedores `[JUNTA]`
- El borrado de proveedores es logico (no se elimina de la base de datos)
- El RIF debe tener formato valido: V/E/J/G + numeros
- No se permiten RIFs duplicados dentro del mismo condominio

### Multitenancy
- Todos los datos estan aislados por condominio del administrador autenticado
- Un administrador nunca ve datos de otro condominio

---

## 6. Referencia tecnica (rutas y endpoints)

Archivo de composicion del backend: `habioo-auth/index.ts`

### `routes/auth.ts`
- `POST /register`
- `POST /login`
- `GET /me`

### `routes/perfil.ts` (montado en `/api/perfil`)
- `GET /api/perfil/`
- `PUT /api/perfil/`
- `PUT /api/perfil/password`
- `POST /api/perfil/upload/:tipo`

### `routes/proveedores.ts` `[JUNTA]`
- `GET /proveedores`
- `POST /proveedores`
- `POST /proveedores/lote`
- `PUT /proveedores/:id`
- `DELETE /proveedores/:id`

### `routes/gastos.ts` `[JUNTA]`
- `POST /gastos`
- `GET /gastos`
- `DELETE /gastos/:id`
- `GET /preliminar`
- `PUT /metodo-division`
- `POST /cerrar-ciclo`

### `routes/recibos.ts` `[AMBOS]`
- `GET /recibos-historial`
- `GET /recibos/:id/aviso`

### `routes/pagos.ts`
- `POST /pagos-admin` `[JUNTA]`
- `POST /pagos-propietario` `[PROPIETARIO]`
- `GET /pagos/pendientes-aprobacion` `[JUNTA]`
- `POST /pagos/:id/validar` `[JUNTA]`
- `POST /pagos/:id/rechazar` `[JUNTA]`
- `POST /pagos/:id/rollback` `[JUNTA]` — revierte un pago validado (ventana de 48 horas)
- `GET /pagos-proveedores/gasto/:gasto_id/detalles` `[JUNTA]`
- `POST /pagos-proveedores` `[JUNTA]`

### `routes/propietario.ts` (montado en `/api/propietario`) `[PROPIETARIO]`
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

### `routes/bancos.ts` `[JUNTA]`
- `GET /bancos`
- `POST /bancos`
- `PUT /bancos/:id/predeterminada`
- `DELETE /bancos/:id`
- `GET /bancos-admin/:id/estado-cuenta`
- `POST /transferencias`
- `GET /gastos-pendientes-pago`

### `routes/fondos.ts` `[JUNTA]`
- `GET /fondos`
- `POST /fondos`
- `DELETE /fondos/:id`

### `routes/zonas.ts` `[JUNTA]`
- `GET /zonas`
- `POST /zonas`
- `PUT /zonas/:id`
- `DELETE /zonas/:id`

### `routes/propiedades.ts` `[JUNTA]`
- `GET /propiedades-admin`
- `DELETE /propiedades-admin/eliminar-todos`
- `GET /propiedades-admin/:id/estado-cuenta`
- `POST /propiedades-admin/lote`
- `POST /propiedades-admin`
- `PUT /propiedades-admin/:id`
- `DELETE /propiedades-admin/:id`
- `POST /propiedades-admin/:id/ajustar-saldo`

### `routes/dashboard.ts`
- `GET /mis-propiedades` `[AMBOS]`
- `GET /mis-finanzas` `[AMBOS]`
- `GET /cuentas-por-cobrar` `[JUNTA]`
- `POST /dashboard-admin/seed-prueba` `[JUNTA]`

---

## 7. Modelo de datos

- `users`: autenticacion y actores del sistema
- `condominios`: configuracion del condominio (perfil, reglas, mensajes de aviso)
- `propiedades`: inmuebles (identificador, alicuota, saldo_actual, etc.)
- `usuarios_propiedades`: relacion propietario/inquilino con inmueble
- `zonas`, `propiedades_zonas`: segmentacion por areas/sectores
- `proveedores`: proveedores por condominio
- `gastos`, `gastos_cuotas`: origen de deuda mensual y diferimiento
- `recibos`: aviso/recibo por inmueble con snapshot_jsonb (inmutable al emitir)
- `pagos`: pagos de propietarios y su validacion
- `cuentas_bancarias`, `fondos`, `movimientos_fondos`: tesoreria y trazabilidad
- `cortes_estado_cuenta_fondos`: snapshots mensuales por aviso para historico del propietario
- `historial_saldos_inmuebles`: auditoria de ajustes y saldos iniciales

---

## 8. Modelo organizacional

Jerarquia: **JG** (Junta General) -> **JI** (Junta Individual / Condominio) -> **Propietario**

- **Junta General**: ve a cada JI como un cliente economico (no ve propietarios individuales). Registra gastos globales que se asignan a las JI.
- **Junta Individual**: recibe gastos de la JG y los proratea entre sus propietarios por alicuota o partes iguales. Sus datos internos son privados para la JG.
- **Propietario**: ve solo su relacion economica con su JI. Puede auditar la relacion JI-JG (transparencia hacia arriba) pero no ve datos de otros edificios.

### Flujo de un gasto (ejemplo)
1. La JG registra un gasto de $500 por "Limpieza de Areas Comunes" para la Residencia A
2. La JI (Residencia A) debe $500 a la JG
3. El sistema de la JI reparte los $500 entre sus propietarios segun alicuota
4. Al propietario del Apto 2 le llega su aviso con el concepto "Limpieza Areas Comunes" por su cuota correspondiente
5. El propietario puede ver en su portal que su edificio pago los $500 a la JG

**Principio**: ciego hacia abajo (JG no ve propietarios individuales), transparente hacia arriba (propietario puede auditar la relacion JI-JG).

---

## 9. Ejecucion local

### Backend (`habioo-auth`)
- Configurar `.env`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`
- Opcional: `ENABLE_TEST_SEEDER=true` para habilitar seeder de pruebas
- Ejecutar en `http://localhost:3000`

### Frontend (`habioo-frontend`)
- Ejecutar Vite en `http://localhost:5173`
- `API_BASE_URL` se resuelve: `VITE_API_BASE_URL` si esta definida, o `http://localhost:3000` en localhost, o `https://auth.habioo.cloud` en produccion

### Notas de depuracion
- Si cambias entre prod y local y ves error `401`, limpia `localStorage` (token viejo) y vuelve a iniciar sesion
