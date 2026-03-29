import React, { useState } from 'react';

interface ProveedorForm {
  identificador: string;
  nombre: string;
  email: string;
  rubro: string;
  telefono1: string;
  telefono2: string;
  estado_venezuela: string;
  direccion: string;
}

interface Proveedor extends ProveedorForm {
  [key: string]: unknown;
}

interface LoteProveedorRow {
  isValid: boolean;
  identificador: string;
  nombre: string;
  email: string;
  rubro: string;
  telefono1: string;
  estado_venezuela: string;
  direccion: string;
}

interface ModalProveedorFormProps {
  isOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingId: string | number | null;
  formProv: ProveedorForm;
  setFormProv: React.Dispatch<React.SetStateAction<ProveedorForm>>;
  handleProvChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}

interface ModalProveedorDetailsProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  prov: Proveedor | null;
}

interface ModalCargaMasivaProveedoresProps {
  isOpen: boolean;
  setLoteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  loteData: LoteProveedorRow[];
  setLoteData: React.Dispatch<React.SetStateAction<LoteProveedorRow[]>>;
  loteErrors: number;
  isUploadingLote: boolean;
  uploadProgress: number;
  handleDownloadTemplate: () => void | Promise<void>;
  handleSaveLote: () => void | Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
}

const ESTADOS_VENEZUELA: string[] = [
  'Amazonas', 'Anzoategui', 'Apure', 'Aragua', 'Barinas', 'Bolivar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcon', 'Guarico', 'La Guaira',
  'Lara', 'Merida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Tachira', 'Trujillo', 'Yaracuy', 'Zulia'
];

const CATEGORIAS_RUBROS: Record<string, string[]> = {
  'Administracion y gestion': ['Administracion de condominios', 'Contabilidad para condominios', 'Asesoria legal para condominios'],
  'Mantenimiento general': ['Mantenimiento de inmuebles', 'Mantenimiento preventivo', 'Mantenimiento correctivo'],
  'Aseo y limpieza': [
    'Limpieza de areas comunes',
    'Limpieza de estacionamientos',
    'Desinfeccion y sanitizacion',
    'Productos de limpieza',
    'Suministro de insumos de limpieza'
  ],
  'Jardineria y areas verdes': ['Jardineria', 'Mantenimiento de areas verdes', 'Poda de arboles'],
  'Seguridad': [
    'Seguridad privada',
    'Vigilancia fisica',
    'Monitoreo CCTV',
    'Instalacion de camaras',
    'Control de acceso',
    'Control de acceso biometrico',
    'Alarmas y sensores',
    'Cerco electrico',
    'Sistemas contra incendios',
    'Mantenimiento de portones electricos'
  ],
  'Hidraulica y agua': [
    'Servicios hidraulicos',
    'Plomeria general',
    'Deteccion y reparacion de fugas',
    'Destape de tuberias y drenajes',
    'Mantenimiento de bombas de agua',
    'Mantenimiento de hidroneumatico',
    'Limpieza de tanques de agua',
    'Impermeabilizacion de tanques',
    'Tratamiento y filtracion de agua'
  ],
  'Agroindustria y derivados': [
    'Agroindustria y derivados',
    'Suministro agroindustrial',
    'Productos biologicos y derivados',
    'Fertilizantes y acondicionadores de suelo'
  ],
  'Electronica e iluminacion': [
    'Electronica residencial y comercial',
    'Iluminacion de interiores',
    'Iluminacion de exteriores',
    'Sistemas de iluminacion LED',
    'Automatizacion de iluminacion'
  ],
  'Mantenimiento tecnico': ['Electricistas', 'Mantenimiento de ascensores', 'Aire acondicionado'],
  'Infraestructura y construccion': ['Impermeabilizacion', 'Reparacion de fachadas', 'Pintura de inmuebles'],
  'Control de plagas': ['Fumigacion', 'Control de roedores', 'Control de termitas'],
  'Papeleria e impresos': ['Papeleria', 'Material de oficina', 'Impresion de recibos', 'Impresion de avisos y comunicados'],
  'Otros': ['Ferreteria', 'Recoleccion de desechos']
};

const RUBROS_VALIDOS: string[] = Object.values(CATEGORIAS_RUBROS).flat();

const findRubroValido = (value: string): string | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const match = RUBROS_VALIDOS.find((rubro) => rubro.toLowerCase() === normalized);
  return match || null;
};

export const ModalProveedorForm: React.FC<ModalProveedorFormProps> = ({
  isOpen,
  setIsModalOpen,
  editingId,
  formProv,
  setFormProv,
  handleProvChange,
  handleSubmit
}) => {
  const [isRubroOpen, setIsRubroOpen] = useState<boolean>(false);
  const [rubroError, setRubroError] = useState<string>('');

  const validateRubro = (): boolean => {
    const match = findRubroValido(formProv.rubro);
    if (!match) {
      setRubroError('Debe seleccionar una especialidad válida del listado.');
      return false;
    }
    if (match !== formProv.rubro) {
      setFormProv((prev) => ({ ...prev, rubro: match }));
    }
    setRubroError('');
    return true;
  };

  const handleSubmitValidated = (e: React.FormEvent<HTMLFormElement>): void => {
    if (!validateRubro()) {
      e.preventDefault();
      return;
    }
    void handleSubmit(e);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-3xl shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 font-bold text-2xl transition-colors">X</button>

        <div className="mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
          <h3 className="text-2xl font-black text-gray-800 dark:text-white">{editingId ? 'Editar Proveedor' : 'Registrar Proveedor'}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Los campos marcados con (<span className="text-red-500 font-bold">*</span>) son obligatorios.</p>
        </div>

        <form onSubmit={handleSubmitValidated} className="space-y-5" noValidate>
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
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electronico</label>
            <input
              type="text"
              inputMode="email"
              name="email"
              value={formProv.email || ''}
              onChange={handleProvChange}
              placeholder="ejemplo@correo.com"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Especialidad / Rubro <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="rubro"
              value={formProv.rubro}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                handleProvChange(e);
                setIsRubroOpen(true);
                if (rubroError) setRubroError('');
              }}
              onFocus={() => setIsRubroOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsRubroOpen(false), 200);
                validateRubro();
              }}
              placeholder="Ej: Plomeria, Ferreteria..."
              className={`w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white ${
                rubroError ? 'border-red-400 dark:border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
              required
              autoComplete="off"
            />
            {rubroError && (
              <p className="mt-1 text-xs font-bold text-red-500">{rubroError}</p>
            )}

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
                          onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
                            e.preventDefault();
                            setFormProv({ ...formProv, rubro: sub });
                            setRubroError('');
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
};

export const ModalProveedorDetails: React.FC<ModalProveedorDetailsProps> = ({ isOpen, setIsOpen, prov }) => {
  if (!isOpen || !prov) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-3xl shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
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
};

export const ModalCargaMasivaProveedores: React.FC<ModalCargaMasivaProveedoresProps> = ({
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
}) => {
  if (!isOpen) return null;

  const handleClose = (): void => {
    if (isUploadingLote) return;
    setLoteData([]);
    setLoteModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
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
};
