import { useState } from 'react';
import ModalBase from '../ui/ModalBase';
import DataTable from '../ui/DataTable';
import FormField, { inputClass } from '../ui/FormField';

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
  'Servicios basicos': [
    'Servicio de agua',
    'Servicio de electricidad',
    'Servicio de gas'
  ],
  'Agroindustria y derivados': [
    'Agroindustria y derivados',
    'Suministro agroindustrial',
    'Productos biologicos y derivados',
    'Fertilizantes y acondicionadores de suelo'
  ],
  'Banca': [
    'Entidad Bancaria'
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
    <ModalBase
      onClose={() => setIsModalOpen(false)}
      title={editingId ? 'Editar Proveedor' : 'Registrar Proveedor'}
      helpTooltip="Usa este modal para crear o actualizar proveedores: datos fiscales, contacto, rubro, ubicacion y estado operativo."
      subtitle={<>Los campos marcados con (<span className="text-red-500 font-bold">*</span>) son obligatorios.</>}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmitValidated} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Identificador / RIF" required>
              <input
                type="text"
                name="identificador"
                value={formProv.identificador}
                onChange={handleProvChange}
                pattern="^[VEJG][0-9]{5,9}$"
                placeholder="Ej: J123456789"
                disabled={editingId !== null}
                className={`${inputClass} font-mono uppercase`}
                required
              />
            </FormField>
            <FormField label="Nombre / Razon Social" required>
              <input type="text" name="nombre" value={formProv.nombre} onChange={handleProvChange} className={inputClass} required />
            </FormField>
          </div>

          <FormField label="Correo Electronico">
            <input type="text" inputMode="email" name="email" value={formProv.email || ''} onChange={handleProvChange} placeholder="ejemplo@correo.com" className={inputClass} />
          </FormField>

          <div className="relative">
            <FormField label="Especialidad / Rubro" required error={rubroError}>
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
              className={`${inputClass} ${rubroError ? 'border-red-400 dark:border-red-500' : ''}`}
              required
              autoComplete="off"
            />
            </FormField>

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
            <FormField label="Telefono Principal" required>
              <input type="text" name="telefono1" value={formProv.telefono1} onChange={handleProvChange} inputMode="numeric" pattern="^[0-9]{7,15}$" className={inputClass} required />
            </FormField>
            <FormField label="Telefono Secundario">
              <input type="text" name="telefono2" value={formProv.telefono2} onChange={handleProvChange} inputMode="numeric" pattern="^[0-9]{7,15}$" className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <FormField label="Estado" required>
                <select name="estado_venezuela" value={formProv.estado_venezuela} onChange={handleProvChange} className={inputClass} required>
                  <option value="">Seleccione...</option>
                  {ESTADOS_VENEZUELA.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Direccion Fisica Exacta" required>
                <input type="text" name="direccion" value={formProv.direccion} onChange={handleProvChange} className={inputClass} required />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-gray-200/80 dark:border-gray-700/60">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30"
            >
              {editingId ? 'Guardar Cambios' : 'Guardar Proveedor'}
            </button>
          </div>
      </form>
    </ModalBase>
  );
};

export const ModalProveedorDetails: React.FC<ModalProveedorDetailsProps> = ({ isOpen, setIsOpen, prov }) => {
  if (!isOpen || !prov) return null;

  return (
    <ModalBase onClose={() => setIsOpen(false)} title="Detalles del Proveedor" helpTooltip="Vista de solo lectura para consultar la ficha completa del proveedor y validar su informacion registrada." maxWidth="max-w-3xl">
      <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Identificador / RIF">
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 font-mono uppercase">{prov.identificador}</div>
            </FormField>
            <FormField label="Nombre / Razon Social">
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 font-bold">{prov.nombre}</div>
            </FormField>
          </div>

          <FormField label="Correo Electronico">
            <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.email || 'No especificado'}</div>
          </FormField>

          <FormField label="Especialidad / Rubro">
            <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-blue-600 dark:text-blue-400 font-bold">{prov.rubro || 'No especificado'}</div>
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Telefono Principal">
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.telefono1 || 'No especificado'}</div>
            </FormField>
            <FormField label="Telefono Secundario">
              <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.telefono2 || 'No especificado'}</div>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <FormField label="Estado">
                <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.estado_venezuela || 'No especificado'}</div>
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Direccion Fisica Exacta">
                <div className="w-full p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200">{prov.direccion || 'No especificada'}</div>
              </FormField>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-donezo-primary"
            >
              Cerrar Detalles
            </button>
          </div>
      </div>
    </ModalBase>
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
    <ModalBase
      onClose={handleClose}
      title="Carga Masiva de Proveedores"
      subtitle={loteData.length > 0 ? <>Se encontraron {loteData.length} registros.{loteErrors > 0 && <span className="text-red-500 font-bold ml-2">Hay {loteErrors} errores detectados.</span>}</> : undefined}
      maxWidth="3xl"
      disableClose={isUploadingLote}
    >
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

              <DataTable
                columns={[
                  { key: 'estado', header: 'Estado', headerClassName: 'text-center', className: 'text-center', render: (row) => row.isValid ? <span className="text-green-500 text-lg">OK</span> : <span className="text-red-500 text-lg">ERR</span> },
                  { key: 'rif', header: 'RIF', className: 'font-bold font-mono text-gray-800 dark:text-white', render: (row) => row.identificador },
                  { key: 'nombre', header: 'Nombre', className: 'text-gray-700 dark:text-gray-300 font-medium', render: (row) => row.nombre },
                  { key: 'correo', header: 'Correo', className: 'text-gray-600 dark:text-gray-400 text-xs', render: (row) => row.email || '-' },
                  { key: 'rubro', header: 'Rubro', className: 'text-gray-500 dark:text-gray-400 text-xs', render: (row) => row.rubro || '-' },
                  { key: 'telefono', header: 'Telefono Principal', className: 'font-mono text-gray-600 dark:text-gray-400', render: (row) => row.telefono1 },
                  { key: 'estado_ve', header: 'Estado / Provincia', className: 'text-gray-600 dark:text-gray-400 text-xs font-semibold', render: (row) => row.estado_venezuela },
                  { key: 'direccion', header: 'Direccion', className: 'text-gray-500 dark:text-gray-400 text-xs truncate max-w-[200px]', render: (row) => <span title={row.direccion}>{row.direccion}</span> },
                ]}
                data={loteData}
                keyExtractor={(_, i) => i}
                rowClassName={(row) => `border-b ${row.isValid ? 'border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}
              />
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200/80 dark:border-gray-700/60">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                {!isUploadingLote ? (
                  <label className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer text-sm">Subir otro archivo<input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} /></label>
                ) : (
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 animate-pulse">Guardando...</span>
                )}

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleClose}
                    disabled={isUploadingLote}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100/60 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveLote}
                    disabled={loteErrors > 0 || isUploadingLote}
                    className="px-7 py-2.5 rounded-xl bg-green-600 text-sm font-bold text-white shadow-md shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingLote ? 'Guardando...' : `Confirmar y Guardar ${loteData.length}`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
    </ModalBase>
  );
};
