import { formatMoney } from '../../utils/currency';

export function ModalPropiedadForm({
  isOpen,
  editingId,
  form,
  setForm,
  handleChange,
  handleSubmit,
  setIsModalOpen
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{editingId ? '✏️ Editar Inmueble' : '🏠 Nuevo Inmueble'}</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-donezo-primary mb-3 text-sm uppercase tracking-wider">1. Datos del Inmueble</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Identificador *</label><input type="text" name="identificador" value={form.identificador} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Alícuota (%) *</label><input type="text" name="alicuota" value={form.alicuota} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" required /></div>
              {!editingId && (
                <div className="flex gap-2">
                  <div className="flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">Saldo Inicial (USD)</label><input type="text" name="monto_saldo_inicial" value={form.monto_saldo_inicial} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-mono" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label><select name="tipo_saldo_inicial" value={form.tipo_saldo_inicial} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white font-bold text-sm"><option value="CERO">Sin Saldo</option><option value="DEUDA">Deuda (-)</option><option value="FAVOR">A Favor (+)</option></select></div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-3 text-sm uppercase tracking-wider">2. Datos del Propietario (Login)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Cédula (Usuario) *</label><input type="text" name="prop_cedula" value={form.prop_cedula} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white uppercase" required /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Nombre Completo *</label><input type="text" name="prop_nombre" value={form.prop_nombre} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" required /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Email</label><input type="email" name="prop_email" value={form.prop_email} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Teléfono</label><input type="text" name="prop_telefono" value={form.prop_telefono} onChange={handleChange} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white" /></div>
              {editingId && (<div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-200 dark:border-yellow-800"><label className="block text-xs font-bold text-yellow-800 dark:text-yellow-500 mb-1">🔑 Restablecer Contraseña</label><input type="password" name="prop_password" value={form.prop_password} onChange={handleChange} placeholder="Nueva clave..." className="w-full p-2.5 rounded-xl border border-yellow-300 dark:bg-gray-800 outline-none dark:text-white" /></div>)}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setForm({ ...form, tiene_inquilino: !form.tiene_inquilino })}><input type="checkbox" checked={form.tiene_inquilino} readOnly className="w-5 h-5 text-donezo-primary" /><h4 className="font-bold text-gray-700 dark:text-gray-300">¿Tiene Inquilino Residente?</h4></div>
            {form.tiene_inquilino && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><input type="text" name="inq_cedula" value={form.inq_cedula} onChange={handleChange} placeholder="Cédula *" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white uppercase" required /><input type="text" name="inq_nombre" value={form.inq_nombre} onChange={handleChange} placeholder="Nombre *" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" required /><input type="email" name="inq_email" value={form.inq_email} onChange={handleChange} placeholder="Email" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" /><input type="text" name="inq_telefono" value={form.inq_telefono} onChange={handleChange} placeholder="Teléfono" className="p-2.5 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white" /></div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 transition-all">{editingId ? 'Guardar Cambios' : 'Registrar Inmueble'}</button></div>
        </form>
      </div>
    </div>
  );
}

export function ModalEstadoCuenta({
  isOpen,
  selectedPropCuenta,
  setEstadoCuentaModalOpen,
  selectedPropAjuste,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  handleOpenAjuste,
  loadingCuenta,
  estadoCuentaFiltrado,
  totalCargo,
  totalAbono
}) {
  if (!isOpen || !selectedPropCuenta) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h3 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
              {selectedPropCuenta.identificador} <span className="text-gray-300 font-normal">|</span> {selectedPropCuenta.prop_nombre}
            </h3>
            {selectedPropCuenta.inq_nombre && (
              <p className="text-sm font-medium text-gray-500 mt-1">Inquilino Residente: <span className="text-gray-700 dark:text-gray-300">{selectedPropCuenta.inq_nombre}</span></p>
            )}
          </div>
          <button onClick={() => setEstadoCuentaModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors">✕</button>
        </div>

        <div className="px-6 py-4 flex flex-wrap justify-between items-end gap-4 bg-white dark:bg-donezo-card-dark border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-3 items-center">
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Desde</label>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 outline-none dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Hasta</label>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 outline-none dark:text-white" />
            </div>
          </div>
          <button onClick={() => handleOpenAjuste(selectedPropCuenta)} className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2">
            ⚖️ Ajustar Saldo Manual
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-donezo-card-dark custom-scrollbar">
          {loadingCuenta ? <p className="text-center text-gray-400 py-10">Cargando movimientos...</p> : estadoCuentaFiltrado.length === 0 ? <p className="text-center text-gray-400 py-10">No hay movimientos en este rango de fechas.</p> : (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-white dark:bg-donezo-card-dark shadow-sm">
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="p-3 font-bold uppercase text-[11px]">Fecha Op.</th>
                  <th className="p-3 font-bold uppercase text-[11px]">Fecha Sistema</th>
                  <th className="p-3 font-bold uppercase text-[11px]">Concepto</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Cargos (Deuda)</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right">Abonos (Pago)</th>
                  <th className="p-3 font-bold uppercase text-[11px] text-right text-donezo-primary">Saldo Fila</th>
                </tr>
              </thead>
              <tbody>
                {estadoCuentaFiltrado.map((m, idx) => (
                  <tr key={idx} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 text-gray-600 dark:text-gray-300 font-mono text-xs">{new Date(m.fecha_operacion).toLocaleDateString()}</td>
                    <td className="p-3 text-gray-400 font-mono text-[10px]">{new Date(m.fecha_registro).toLocaleString()}</td>
                    <td className="p-3 font-medium text-gray-800 dark:text-gray-200">{m.tipo === 'RECIBO' ? '📄 ' : m.tipo === 'PAGO' ? '💵 ' : '⚖️ '} {m.concepto}</td>
                    <td className="p-3 text-right text-red-500 font-mono font-medium">{m.cargo > 0 ? `$${formatMoney(m.cargo)}` : '-'}</td>
                    <td className="p-3 text-right text-green-500 font-mono font-medium">{m.abono > 0 ? `$${formatMoney(m.abono)}` : '-'}</td>
                    <td className="p-3 text-right font-mono font-black text-gray-800 dark:text-white">${formatMoney(m.saldoFila)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
                  <td colSpan="3" className="p-4 text-right font-black uppercase text-xs text-gray-600 dark:text-gray-300 tracking-wider">TOTALES MOSTRADOS:</td>
                  <td className="p-4 text-right font-black text-red-600 font-mono">${formatMoney(totalCargo)}</td>
                  <td className="p-4 text-right font-black text-green-600 font-mono">${formatMoney(totalAbono)}</td>
                  <td className="p-4"></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function ModalAjusteSaldo({
  isOpen,
  selectedPropAjuste,
  setAjusteModalOpen,
  formAjuste,
  setFormAjuste,
  handleSubmitAjuste
}) {
  if (!isOpen || !selectedPropAjuste) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
        <button onClick={() => setAjusteModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">⚖️ Ajustar Saldo</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Inmueble: <strong className="text-donezo-primary">{selectedPropAjuste.identificador}</strong></p>

        <form onSubmit={handleSubmitAjuste} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Acción a realizar</label>
            <select value={formAjuste.tipo_ajuste} onChange={e => setFormAjuste({ ...formAjuste, tipo_ajuste: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-bold outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white">
              <option value="CARGAR_DEUDA">🔴 Cargar Deuda (+)</option>
              <option value="AGREGAR_FAVOR">🟢 Agregar a Favor (-)</option>
            </select>
          </div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto ($)</label><input type="text" value={formAjuste.monto} onChange={e => setFormAjuste({ ...formAjuste, monto: e.target.value.replace(/\./g, ',').replace(/[^0-9,]/g, '') })} placeholder="Ej: 50,00" className="w-full p-3 rounded-xl border font-mono text-lg dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white" required /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (Auditoría) *</label><textarea value={formAjuste.nota} onChange={e => setFormAjuste({ ...formAjuste, nota: e.target.value })} placeholder="Ej: Cobro de multa" className="w-full p-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 outline-none dark:text-white text-sm min-h-[80px]" required /></div>
          <div className="pt-4 flex gap-3"><button type="button" onClick={() => setAjusteModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors">Cancelar</button><button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-yellow-500 text-white hover:bg-yellow-600 transition-all">Aplicar Ajuste</button></div>
        </form>
      </div>
    </div>
  );
}

// 💡 MODAL PARA CARGA MASIVA DE EXCEL CON PASO A PASO
// 💡 MODAL PARA CARGA MASIVA DE EXCEL
export function ModalCargaMasiva({
  isOpen,
  setLoteModalOpen,
  loteData,
  setLoteData,
  loteErrors,
  isUploadingLote,
  uploadProgress, // 💡 Recibe el progreso
  handleDownloadTemplate,
  handleSaveLote,
  handleFileUpload
}) {
  if (!isOpen) return null;

  const handleClose = () => {
    // Evitar cierre accidental durante la carga
    if (isUploadingLote) return;
    setLoteData([]); 
    setLoteModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CABECERA */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
           <div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                📊 Carga Masiva de Inmuebles
              </h3>
              {loteData.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Se encontraron {loteData.length} registros. 
                  {loteErrors > 0 && <span className="text-red-500 font-bold ml-2">Hay {loteErrors} errores detectados.</span>}
                </p>
              )}
           </div>
           {/* 💡 Botón X desactivado durante la carga */}
           <button 
             onClick={handleClose} 
             disabled={isUploadingLote}
             className={`text-gray-400 font-bold text-2xl transition-colors ${isUploadingLote ? 'opacity-30 cursor-not-allowed' : 'hover:text-red-500'}`}
           >
             ✕
           </button>
        </div>

        {loteData.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center bg-white dark:bg-donezo-card-dark min-h-[300px]">
            <div className="text-6xl mb-4">📑</div>
            <h4 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Importar desde Excel</h4>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-8">
              Para cargar múltiples propiedades de golpe, descarga nuestra plantilla de Excel, llénala con los datos y súbela al sistema. Las cédulas se usarán como claves temporales.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
               <button onClick={handleDownloadTemplate} className="flex-1 py-3 px-4 rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 hover:bg-blue-100 transition-colors shadow-sm">
                 1. Descargar Plantilla
               </button>
               <label className="flex-1 py-3 px-4 rounded-xl bg-green-600 text-white font-bold cursor-pointer shadow-md hover:bg-green-700 transition-all text-center">
                 2. Subir Archivo
                 <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
               </label>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-donezo-card-dark custom-scrollbar relative">
              {/* 💡 OVERLAY DE BLOQUEO PARA LA TABLA MIENTRAS CARGA */}
              {isUploadingLote && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-4 w-full max-w-sm">
                      <span className="font-bold text-gray-800 dark:text-white text-lg">Procesando {loteData.length} registros...</span>
                      <p className="text-sm text-gray-500 text-center">Por favor, no cierre esta ventana mientras se guardan los datos.</p>
                      
                      {/* BARRA DE PROGRESO CENTRADA */}
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative shadow-inner mt-2">
                        <div
                          className="bg-green-500 h-4 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${Math.round(uploadProgress)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">{Math.round(uploadProgress)}%</span>
                   </div>
                </div>
              )}
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 shadow-sm z-10">
                  <tr className="text-gray-600 dark:text-gray-300">
                    <th className="p-3 font-bold text-center">Estado</th>
                    <th className="p-3 font-bold">Apto/Casa</th>
                    <th className="p-3 font-bold">Propietario</th>
                    <th className="p-3 font-bold">Cédula</th>
                    <th className="p-3 font-bold">Correo</th>
                    <th className="p-3 font-bold">Teléfono</th>
                    <th className="p-3 font-bold text-right">Alícuota</th>
                    <th className="p-3 font-bold text-right">Saldo Inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {loteData.map((row, i) => (
                    <tr key={i} className={`border-b ${row.isValid ? 'border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                      <td className="p-3 text-center">{row.isValid ? <span className="text-green-500 text-lg" title="Correcto">✅</span> : <span className="text-red-500 text-lg cursor-help" title={row.errors}>❌</span>}</td>
                      <td className="p-3 font-bold text-gray-800 dark:text-white">{row.identificador}</td>
                      <td className="p-3"><div className="text-gray-700 dark:text-gray-300 font-medium">{row.nombre}</div>{!row.isValid && row.errors.includes('Nombre') && <span className="text-[10px] text-red-500 font-bold">Requerido</span>}</td>
                      <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{row.cedula}{!row.isValid && row.errors.includes('Cédula') && <div className="text-[10px] text-red-500 font-bold">Inválida</div>}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">{row.correo || '-'}{!row.isValid && row.errors.includes('Correo duplicado') && <div className="text-[10px] text-red-500 font-bold">Repetido</div>}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">{row.telefono || '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{String(row.alicuota).replace('.', ',')}% {!row.isValid && row.errors.includes('Alícuota') && <div className="text-[10px] text-red-500 font-bold">Debe ser {'>'} 0</div>}</td>
                      <td className="p-3 text-right font-mono font-medium"><span className={parseFloat(row.saldo_inicial) > 0 ? 'text-red-500' : parseFloat(row.saldo_inicial) < 0 ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}>${formatMoney(Math.abs(parseFloat(row.saldo_inicial || 0)))}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PIE Y BOTONES CON BARRA DE PROGRESO */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                {!isUploadingLote ? (
                  <label className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer text-sm">
                     Subir otro archivo
                     <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 animate-pulse">Guardando...</span>
                )}
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    onClick={handleClose} 
                    disabled={isUploadingLote}
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveLote} 
                    disabled={loteErrors > 0 || isUploadingLote} 
                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isUploadingLote ? 'Guardando...' : `Confirmar y Guardar ${loteData.length}`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}