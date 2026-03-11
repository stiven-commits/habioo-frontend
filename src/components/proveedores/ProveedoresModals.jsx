import { useState } from 'react';

const ESTADOS_VENEZUELA = [
  'Amazonas', 'Anzoategui', 'Apure', 'Aragua', 'Barinas', 'Bolivar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcon', 'Guarico', 'La Guaira',
  'Lara', 'Merida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Tachira', 'Trujillo', 'Yaracuy', 'Zulia'
];

const CATEGORIAS_RUBROS = {
  'Administracion y gestion': ['Administracion de condominios', 'Contabilidad para condominios', 'Asesoria legal para condominios'],
  'Mantenimiento general': ['Mantenimiento de edificios', 'Mantenimiento preventivo', 'Mantenimiento correctivo'],
  'Aseo y limpieza': ['Limpieza de edificios', 'Limpieza de estacionamientos', 'Desinfeccion y sanitizacion'],
  'Jardineria y areas verdes': ['Jardineria', 'Mantenimiento de areas verdes', 'Poda de arboles'],
  'Seguridad': ['Seguridad privada', 'Monitoreo de camaras', 'Control de acceso'],
  'Mantenimiento tecnico': ['Electricistas', 'Plomeria', 'Mantenimiento de ascensores', 'Aire acondicionado'],
  'Infraestructura y construccion': ['Impermeabilizacion', 'Reparacion de fachadas', 'Pintura de edificios'],
  'Control de plagas': ['Fumigacion', 'Control de roedores', 'Control de termitas'],
  'Otros': ['Ferreteria', 'Recoleccion de basura', 'Mantenimiento de portones electricos']
};

export function ModalProveedorForm({
  isOpen,
  setIsModalOpen,
  editingId,
  formProv,
  setFormProv,
  handleProvChange,
  handleSubmit
}) {
  const [isRubroOpen, setIsRubroOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-3xl shadow-2xl relative my-8">
        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors">X</button>

        <div className="mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
          <h3 className="text-2xl font-black text-gray-800 dark:text-white">{editingId ? 'Editar Proveedor' : 'Registrar Proveedor'}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Los campos marcados con (<span className="text-red-500 font-bold">*</span>) son obligatorios.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Identificador / RIF <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="identificador"
                value={formProv.identificador}
                onChange={handleProvChange}
                pattern="^[VEJG][0-9]{5,9}$"
                placeholder="Ej: J123456789"
                disabled={editingId !== null}
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white font-mono uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre / Razon Social <span className="text-red-500">*</span></label>
              <input type="text" name="nombre" value={formProv.nombre} onChange={handleProvChange} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electronico <span className="text-red-500">*</span></label>
            <input
              type="email"
              name="email"
              value={formProv.email || ''}
              onChange={handleProvChange}
              placeholder="ejemplo@correo.com"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
              required
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Especialidad / Rubro <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="rubro"
              value={formProv.rubro}
              onChange={(e) => { handleProvChange(e); setIsRubroOpen(true); }}
              onFocus={() => setIsRubroOpen(true)}
              onBlur={() => setTimeout(() => setIsRubroOpen(false), 200)}
              placeholder="Ej: Plomeria, Ferreteria..."
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
              required
              autoComplete="off"
            />

            {isRubroOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar animate-fadeIn">
                {Object.entries(CATEGORIAS_RUBROS).map(([categoria, subrubros]) => {
                  const searchLower = (formProv.rubro || '').toLowerCase();
                  const filteredSubrubros = subrubros.filter((sub) => sub.toLowerCase().includes(searchLower));
                  const catMatches = categoria.toLowerCase().includes(searchLower);
                  if (!catMatches && filteredSubrubros.length === 0) return null;
                  const displaySubs = catMatches ? subrubros : filteredSubrubros;

                  return (
                    <div key={categoria}>
                      <div className="px-4 py-2 font-black text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50/90 dark:bg-gray-900/90 sticky top-0">{categoria}</div>
                      {displaySubs.map((sub) => (
                        <div
                          key={sub}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormProv({ ...formProv, rubro: sub });
                            setIsRubroOpen(false);
                          }}
                          className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 cursor-pointer transition-colors"
                        >
                          {sub}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono Principal <span className="text-red-500">*</span></label><input type="text" name="telefono1" value={formProv.telefono1} onChange={handleProvChange} inputMode="numeric" pattern="^[0-9]{7,15}$" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required /></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono Secundario</label><input type="text" name="telefono2" value={formProv.telefono2} onChange={handleProvChange} inputMode="numeric" pattern="^[0-9]{7,15}$" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado <span className="text-red-500">*</span></label>
              <select name="estado_venezuela" value={formProv.estado_venezuela} onChange={handleProvChange} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required>
                <option value="">Seleccione...</option>
                {ESTADOS_VENEZUELA.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Direccion Fisica Exacta <span className="text-red-500">*</span></label>
              <input type="text" name="direccion" value={formProv.direccion} onChange={handleProvChange} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 transition-all">Cancelar</button>
            <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 transition-all shadow-md">{editingId ? 'Guardar Cambios' : 'Guardar Proveedor'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ModalProveedorDetails({ isOpen, setIsOpen, prov }) {
  if (!isOpen || !prov) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-3xl shadow-2xl relative my-8">
        <button onClick={() => setIsOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors">X</button>

        <div className="mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
          <h3 className="text-2xl font-black text-gray-800 dark:text-white">Detalles del Proveedor</h3>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Identificador / RIF</label>
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 font-mono uppercase">{prov.identificador}</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre / Razon Social</label>
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 font-bold">{prov.nombre}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electronico</label>
            <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.email || 'No especificado'}</div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Especialidad / Rubro</label>
            <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-blue-600 dark:text-blue-400 font-bold">{prov.rubro || 'No especificado'}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono Principal</label>
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.telefono1 || 'No especificado'}</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono Secundario</label>
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.telefono2 || 'No especificado'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estado</label>
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.estado_venezuela || 'No especificado'}</div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Direccion Fisica Exacta</label>
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.direccion || 'No especificada'}</div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={() => setIsOpen(false)} className="px-8 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 transition-all shadow-md">Cerrar Detalles</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModalCargaMasivaProveedores({
  isOpen,
  setLoteModalOpen,
  loteData,
  setLoteData,
  loteErrors,
  isUploadingLote,
  uploadProgress,
  handleDownloadTemplate,
  handleSaveLote,
  handleFileUpload
}) {
  if (!isOpen) return null;

  const handleClose = () => {
    if (isUploadingLote) return;
    setLoteData([]);
    setLoteModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h3 className="text-xl font-black text-gray-800 dark:text-white">Carga Masiva de Proveedores</h3>
            {loteData.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">Se encontraron {loteData.length} registros.{loteErrors > 0 && <span className="text-red-500 font-bold ml-2">Hay {loteErrors} errores detectados.</span>}</p>
            )}
          </div>
          <button onClick={handleClose} disabled={isUploadingLote} className={`text-gray-400 font-bold text-2xl transition-colors ${isUploadingLote ? 'opacity-30 cursor-not-allowed' : 'hover:text-red-500'}`}>X</button>
        </div>

        {loteData.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center bg-white dark:bg-donezo-card-dark min-h-[300px]">
            <h4 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Importar Directorio en Excel</h4>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-lg mb-8">Descarga la plantilla, rellenala y vuelve a subirla. El sistema detectara RIFs duplicados automaticamente.</p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button onClick={handleDownloadTemplate} className="flex-1 py-3 px-4 rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 hover:bg-blue-100 transition-colors shadow-sm">1. Descargar Plantilla</button>
              <label className="flex-1 py-3 px-4 rounded-xl bg-donezo-primary text-white font-bold cursor-pointer shadow-md hover:bg-blue-700 transition-all text-center">
                2. Subir Archivo
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-0 bg-white dark:bg-donezo-card-dark custom-scrollbar relative">
              {isUploadingLote && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-4 w-full max-w-sm">
                    <span className="font-bold text-gray-800 dark:text-white text-lg">Procesando {loteData.length} proveedores...</span>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative shadow-inner mt-2">
                      <div className="bg-donezo-primary h-4 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.round(uploadProgress)}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{Math.round(uploadProgress)}%</span>
                  </div>
                </div>
              )}

              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 shadow-sm z-10">
                  <tr className="text-gray-600 dark:text-gray-300">
                    <th className="p-3 font-bold text-center">Estado</th>
                    <th className="p-3 font-bold">RIF</th>
                    <th className="p-3 font-bold">Nombre</th>
                    <th className="p-3 font-bold">Correo</th>
                    <th className="p-3 font-bold">Rubro</th>
                    <th className="p-3 font-bold">Telefono Principal</th>
                    <th className="p-3 font-bold">Estado / Provincia</th>
                    <th className="p-3 font-bold">Direccion</th>
                  </tr>
                </thead>
                <tbody>
                  {loteData.map((row, i) => (
                    <tr key={i} className={`border-b ${row.isValid ? 'border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                      <td className="p-3 text-center">{row.isValid ? <span className="text-green-500 text-lg">OK</span> : <span className="text-red-500 text-lg">ERR</span>}</td>
                      <td className="p-3 font-bold font-mono text-gray-800 dark:text-white">{row.identificador}</td>
                      <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{row.nombre}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400 text-xs">{row.email || '-'}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">{row.rubro || '-'}</td>
                      <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{row.telefono1}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400 text-xs font-semibold">{row.estado_venezuela}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[200px]" title={row.direccion}>{row.direccion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                {!isUploadingLote ? (
                  <label className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer text-sm">Subir otro archivo<input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} /></label>
                ) : (
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 animate-pulse">Guardando...</span>
                )}

                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={handleClose} disabled={isUploadingLote} className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                  <button onClick={handleSaveLote} disabled={loteErrors > 0 || isUploadingLote} className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all">{isUploadingLote ? 'Guardando...' : `Confirmar y Guardar ${loteData.length}`}</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
