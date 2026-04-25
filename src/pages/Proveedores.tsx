import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { useOutletContext } from 'react-router-dom';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import DropdownMenu from '../components/ui/DropdownMenu';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';
import { ModalProveedorForm, ModalProveedorDetails, ModalCargaMasivaProveedores } from '../components/proveedores/ProveedoresModals';
import { useDialog } from '../components/ui/DialogProvider';
import { sanitizeCedulaRif, sanitizePhone, sanitizeEmail, isValidEmail, isValidPhone, isValidCedulaRif } from '../utils/validators';

const ESTADOS_VENEZUELA = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'
];

interface ProveedoresProps {}

interface OutletContext {
  user: unknown;
  userRole: string;
}

interface Proveedor {
  id: number;
  identificador: string;
  nombre: string;
  email: string | null;
  rubro: string | null;
  telefono1: string | null;
  telefono2: string | null;
  direccion: string | null;
  estado_venezuela: string | null;
}

interface ProveedorForm {
  identificador: string;
  nombre: string;
  email: string;
  rubro: string;
  telefono1: string;
  telefono2: string;
  direccion: string;
  estado_venezuela: string;
}

interface LoteProveedorRow {
  rowNum: number;
  identificador: string;
  nombre: string;
  email: string;
  rubro: string;
  telefono1: string;
  telefono2: string;
  estado_venezuela: string;
  direccion: string;
  isValid: boolean;
  errors: string;
}

interface ModalProveedorDetailsData {
  identificador: string;
  nombre: string;
  email: string;
  rubro: string;
  telefono1: string;
  telefono2: string;
  estado_venezuela: string;
  direccion: string;
  [key: string]: unknown;
}

interface LoteProveedorModalRow {
  isValid: boolean;
  identificador: string;
  nombre: string;
  email: string;
  rubro: string;
  telefono1: string;
  estado_venezuela: string;
  direccion: string;
}

interface ApiListProveedoresResponse {
  status: string;
  proveedores: Proveedor[];
  error?: string;
  message?: string;
}

interface ApiActionResponse {
  status: string;
  error?: string;
  message?: string;
}

type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface DialogContextValue {
  showConfirm: (opts: ConfirmDialogOptions) => Promise<boolean>;
}

const Proveedores: React.FC<ProveedoresProps> = () => {
  const { user, userRole } = useOutletContext<OutletContext>();
  const { showConfirm } = useDialog() as DialogContextValue;
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estados de paginación (configurado a 13 elementos por página)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 13;

  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [selectedProvDetails, setSelectedProvDetails] = useState<Proveedor | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ESTADOS PARA CARGA MASIVA DE PROVEEDORES
  const [loteModalOpen, setLoteModalOpen] = useState<boolean>(false);
  const [loteData, setLoteData] = useState<LoteProveedorRow[]>([]);
  const [loteErrors, setLoteErrors] = useState<number>(0);
  const [isUploadingLote, setIsUploadingLote] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialForm: ProveedorForm = {
    identificador: '', nombre: '', email: '', rubro: '', telefono1: '', telefono2: '', direccion: '', estado_venezuela: ''
  };
  const [formProv, setFormProv] = useState<ProveedorForm>(initialForm);

  const fetchProveedores = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/proveedores`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json() as ApiListProveedoresResponse;
      if (data.status === 'success') setProveedores(data.proveedores);
    } catch (error: unknown) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') { void fetchProveedores(); } }, [userRole]);

  // Si el usuario busca algo, lo devolvemos a la página 1
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const handleProvChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    if (name === 'identificador') {
      setFormProv({ ...formProv, [name]: sanitizeCedulaRif(value) });
      return;
    }
    if (name === 'telefono1' || name === 'telefono2') {
      setFormProv({ ...formProv, [name]: sanitizePhone(value) });
      return;
    }
    if (name === 'email') {
      setFormProv({ ...formProv, [name]: sanitizeEmail(value) });
      return;
    }
    setFormProv({ ...formProv, [name]: value });
  };

  const handleCreateNew = (): void => { setEditingId(null); setFormProv(initialForm); setIsModalOpen(true); };
  const handleViewDetails = (prov: Proveedor): void => { setSelectedProvDetails(prov); setDetailsModalOpen(true); };

  const handleEdit = (prov: Proveedor): void => {
    setEditingId(prov.id);
    setFormProv({
      identificador: prov.identificador, nombre: prov.nombre, email: prov.email || '', rubro: prov.rubro || '',
      telefono1: prov.telefono1 || '', telefono2: prov.telefono2 || '', direccion: prov.direccion || '', estado_venezuela: prov.estado_venezuela || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number, nombre: string): Promise<void> => {
    const ok = await showConfirm({
      title: 'Eliminar proveedor',
      message: `¿Está seguro de que desea eliminar a "${nombre}" del directorio? Sus facturas pasadas se mantendrán intactas.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/proveedores/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json() as ApiActionResponse;
      if (data.status === 'success') void fetchProveedores();
      else alert(data.error);
    } catch (_err: unknown) { alert('Error al eliminar proveedor'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const emailNormalizado = sanitizeEmail(formProv.email);
    if (!isValidCedulaRif(formProv.identificador)) return alert('Error: el RIF/Cédula debe iniciar con V, E, J o G y contener solo números.');
    if (emailNormalizado && !isValidEmail(emailNormalizado)) return alert('Error: el correo del proveedor no tiene un formato válido.');
    if (!isValidPhone(formProv.telefono1)) return alert('Error: el teléfono principal debe tener solo números.');
    if (formProv.telefono2 && !isValidPhone(formProv.telefono2)) return alert('Error: el teléfono secundario debe tener solo números.');
    try {
      const token = localStorage.getItem('habioo_token');
      const url = editingId ? `${API_BASE_URL}/proveedores/${editingId}` : `${API_BASE_URL}/proveedores`;
      const payload = { ...formProv, email: emailNormalizado };
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      const data = await res.json() as ApiActionResponse;
      if (data.status === 'success') { alert(data.message); setFormProv(initialForm); setIsModalOpen(false); void fetchProveedores(); }
      else { alert(data.error || data.message || 'Error al guardar proveedor'); }
    } catch (_error: unknown) { alert('Error de conexión al servidor.'); }
  };

  // ==========================================
  // FUNCIONES DE CARGA MASIVA DE PROVEEDORES
  // ==========================================
  const handleDownloadTemplate = (): void => {
    const data = [
      { RIF: 'J123456789', Nombre: 'Ferretería El Clavo', Email: 'contacto@elclavo.com', Rubro: 'Ferretería', Telefono1: '04141234567', Telefono2: '', Estado: 'Distrito Capital', Direccion: 'Av. Principal, Edificio Torre 1' },
      { RIF: 'V87654321', Nombre: 'Juan Pérez Plomería', Email: 'jp.plomeria@gmail.com', Rubro: 'Plomería', Telefono1: '04129876543', Telefono2: '04161234567', Estado: 'Miranda', Direccion: 'Calle 4, Local 2' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);

    if (ws['A1']) ws['A1'].c = [{ a: 'Sistema', t: 'Obligatorio. Letra mayúscula inicial.' }];
    if (ws['C1']) ws['C1'].c = [{ a: 'Sistema', t: 'Opcional. Si se indica, debe ser un correo valido.' }];
    if (ws['D1']) ws['D1'].c = [{ a: 'Sistema', t: 'Opcional. Trate de escribir un rubro conocido (ej: Electricistas, Seguridad).' }];
    if (ws['E1']) ws['E1'].c = [{ a: 'Sistema', t: 'Obligatorio.' }];
    if (ws['G1']) ws['G1'].c = [{ a: 'Sistema', t: 'Obligatorio. Debe estar escrito igual a la lista oficial (Ej: Distrito Capital, Zulia, Miranda).' }];

    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
    XLSX.writeFile(wb, "Plantilla_Habioo_Proveedores.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const bstr = event.target?.result as string;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const sheetName = wb.SheetNames[0];
      if (sheetName === undefined) return;
      const ws = wb.Sheets[sheetName];
      if (ws === undefined) return;
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      let errCount = 0;
      const seenRIFs = new Set<string>();

      const parsedData: LoteProveedorRow[] = rawData.map((row: Record<string, unknown>, index: number) => {
        const rifRaw = row['RIF'] || row['Identificador'] || '';
        const nombre = row['Nombre'] || row['Razón Social'] || row['Razon Social'] || '';
        const email = row['Email'] || row['Correo'] || row['Correo Electrónico'] || row['Correo Electronico'] || '';
        const rubro = row['Rubro'] || row['Especialidad'] || '';
        const tel1 = row['Telefono1'] || row['Teléfono1'] || row['Teléfono Principal'] || row['Telefono Principal'] || row['Telefono'] || '';
        const tel2 = row['Telefono2'] || row['Teléfono2'] || row['Teléfono Secundario'] || '';
        const estado = row['Estado'] || '';
        const direccion = row['Direccion'] || row['Dirección'] || '';

        const rifFmt = sanitizeCedulaRif(String(rifRaw));
        const emailFmt = sanitizeEmail(String(email));
        const emailOk = !emailFmt || isValidEmail(emailFmt);
        const tel1Fmt = sanitizePhone(String(tel1));
        const tel2Fmt = sanitizePhone(String(tel2));

        const errorMsg: string[] = [];
        if (!rifFmt) errorMsg.push('RIF inválido');
        if (!nombre) errorMsg.push('Nombre vacío');
        if (!emailOk) errorMsg.push('Correo inválido');
        if (!tel1Fmt) errorMsg.push('Teléfono principal requerido');
        if (tel1Fmt && !isValidPhone(tel1Fmt)) errorMsg.push('Teléfono principal inválido');
        if (tel2Fmt && !isValidPhone(tel2Fmt)) errorMsg.push('Teléfono secundario inválido');
        if (!estado || !ESTADOS_VENEZUELA.includes(String(estado))) errorMsg.push('Estado inválido');
        if (!direccion) errorMsg.push('Dirección vacía');

        if (rifFmt) {
          if (seenRIFs.has(rifFmt)) { errorMsg.push("RIF duplicado en el archivo"); }
          else { seenRIFs.add(rifFmt); }
        }

        if (errorMsg.length > 0) errCount++;

        return {
          rowNum: index + 2,
          identificador: rifFmt,
          nombre: String(nombre).trim(),
          email: emailFmt,
          rubro: String(rubro).trim(),
          telefono1: tel1Fmt,
          telefono2: tel2Fmt,
          estado_venezuela: String(estado).trim(),
          direccion: String(direccion).trim(),
          isValid: errorMsg.length === 0,
          errors: errorMsg.join(' | ')
        };
      });

      setLoteData(parsedData);
      setLoteErrors(errCount);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const setLoteDataForModal: React.Dispatch<React.SetStateAction<LoteProveedorModalRow[]>> = (value) => {
    setLoteData((prev: LoteProveedorRow[]) => {
      const toModalRows = (rows: LoteProveedorRow[]): LoteProveedorModalRow[] =>
        rows.map((row: LoteProveedorRow) => ({
          isValid: row.isValid,
          identificador: row.identificador,
          nombre: row.nombre,
          email: row.email,
          rubro: row.rubro,
          telefono1: row.telefono1,
          estado_venezuela: row.estado_venezuela,
          direccion: row.direccion,
        }));
      const nextRows = typeof value === 'function' ? value(toModalRows(prev)) : value;
      return nextRows.map((row: LoteProveedorModalRow, index: number) => ({
        rowNum: prev[index]?.rowNum ?? index + 1,
        telefono2: prev[index]?.telefono2 ?? '',
        errors: prev[index]?.errors ?? '',
        ...row,
      }));
    });
  };

  const handleSaveLote = async (): Promise<void> => {
    if (loteErrors > 0) return alert("Por favor corrija los errores en el Excel antes de continuar.");
    const ok = await showConfirm({
      title: 'Importar proveedores',
      message: `¿Está seguro de importar ${loteData.length} proveedores?`,
      confirmText: 'Importar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    setIsUploadingLote(true);
    setUploadProgress(0);

    const progressInterval: ReturnType<typeof setInterval> = setInterval(() => {
      setUploadProgress((prev: number) => {
        if (prev >= 90) return 90;
        return prev + (Math.random() * 15);
      });
    }, 500);

    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/proveedores/lote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ proveedores: loteData })
      });

      clearInterval(progressInterval);
      const data = await res.json() as ApiActionResponse;

      if (data.status === 'success') {
        setUploadProgress(100);
        setTimeout(() => {
          alert(data.message); setLoteModalOpen(false); setLoteData([]); void fetchProveedores(); setIsUploadingLote(false); setUploadProgress(0);
        }, 500);
      } else {
        setIsUploadingLote(false); setUploadProgress(0); alert("Error: " + (data.error || data.message));
      }
    } catch (_err: unknown) {
      clearInterval(progressInterval); setIsUploadingLote(false); setUploadProgress(0); alert('Error de conexión al cargar lote.');
    }
  };

  // Lógica de filtrado y paginación
  const filteredProveedores = proveedores.filter((p: Proveedor) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.rubro && p.rubro.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProveedores.length / itemsPerPage);

  // Extraemos solo los proveedores que corresponden a la página actual
  const currentProveedores = filteredProveedores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (userRole !== 'Administrador') { return <section className="p-6"><p>No tienes permisos para gestionar proveedores.</p></section>; }

  return (
    <div className="space-y-6 relative">
      <PageHeader
        title="Directorio Proveedores"
        subtitle="Gestión de proveedores, datos de contacto y rubros"
        actions={
          <>
            <button onClick={() => setLoteModalOpen(true)} className="flex-1 xl:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:border-blue-800/50 dark:text-blue-400 font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-sm">
              Carga masiva
            </button>
            <button onClick={handleCreateNew} className="flex-1 xl:flex-none bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md text-sm whitespace-nowrap">
              + Nuevo Proveedor
            </button>
          </>
        }
      >
        <input type="text" placeholder="Buscar por nombre, RIF, correo o rubro..." value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
      </PageHeader>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 p-6">Cargando directorio...</p> : currentProveedores.length === 0 ? <p className="text-gray-500 text-center py-10">No se encontraron proveedores activos.</p> : (
          <>
            <div className="w-full pb-32">
              <DataTable
                columns={[
                  {
                    key: 'rif',
                    header: 'RIF / Identificador',
                    className: 'font-mono font-medium text-gray-600 dark:text-gray-400',
                    render: (p) => p.identificador,
                  },
                  {
                    key: 'nombre',
                    header: 'Nombre y Rubro',
                    render: (p) => (
                      <>
                        <div className="font-bold text-gray-800 dark:text-white text-base">{p.nombre}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{p.email || 'Sin correo'}</div>
                        {p.rubro && <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase">{p.rubro}</span>}
                      </>
                    ),
                  },
                  {
                    key: 'telefonos',
                    header: 'Teléfonos',
                    className: 'text-gray-600 dark:text-gray-400 text-sm',
                    render: (p) => (
                      <>{p.telefono1}{p.telefono2 && <><br /><span className="text-gray-400 text-xs">{p.telefono2}</span></>}</>
                    ),
                  },
                  {
                    key: 'acciones',
                    header: 'Acciones',
                    headerClassName: 'text-center',
                    className: 'text-center',
                    render: (p) => (
                      <DropdownMenu
                        width={192}
                        items={[
                          { label: 'Ver detalles', onClick: () => handleViewDetails(p), className: 'text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30' },
                          { label: 'Editar datos', onClick: () => handleEdit(p) },
                          { label: 'Eliminar', onClick: () => { void handleDelete(p.id, p.nombre); }, variant: 'danger' },
                        ]}
                      />
                    ),
                  },
                ]}
                data={currentProveedores}
                keyExtractor={(p) => p.id}
              />
            </div>

            {/* Controles de paginación */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
                <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  ← Anterior
                </button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALES IMPORTADAS */}
      <ModalProveedorForm isOpen={isModalOpen} setIsModalOpen={setIsModalOpen} editingId={editingId} formProv={formProv} setFormProv={setFormProv} handleProvChange={handleProvChange} handleSubmit={handleSubmit} />
      <ModalProveedorDetails
        isOpen={detailsModalOpen}
        setIsOpen={setDetailsModalOpen}
        prov={selectedProvDetails ? ({
          ...selectedProvDetails,
          email: selectedProvDetails.email ?? '',
          rubro: selectedProvDetails.rubro ?? '',
          telefono1: selectedProvDetails.telefono1 ?? '',
          telefono2: selectedProvDetails.telefono2 ?? '',
          estado_venezuela: selectedProvDetails.estado_venezuela ?? '',
          direccion: selectedProvDetails.direccion ?? '',
        } as ModalProveedorDetailsData) : null}
      />

      <ModalCargaMasivaProveedores
        isOpen={loteModalOpen} setLoteModalOpen={setLoteModalOpen} loteData={loteData} setLoteData={setLoteDataForModal} loteErrors={loteErrors}
        isUploadingLote={isUploadingLote} uploadProgress={uploadProgress} handleDownloadTemplate={handleDownloadTemplate} handleSaveLote={handleSaveLote} handleFileUpload={handleFileUpload}
      />
    </div>
  );
};

export default Proveedores;
