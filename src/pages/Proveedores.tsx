import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';
import { ModalProveedorForm, ModalProveedorDetails, ModalCargaMasivaProveedores } from '../components/proveedores/ProveedoresModals';
import { useDialog } from '../components/ui/DialogProvider';
import { sanitizeCedulaRif, sanitizePhone, sanitizeEmail, isValidEmail, isValidPhone, isValidCedulaRif } from '../utils/validators';

const ESTADOS_VENEZUELA = [
  "Amazonas", "AnzoÃ¡tegui", "Apure", "Aragua", "Barinas", "BolÃ­var", "Carabobo",
  "Cojedes", "Delta Amacuro", "Distrito Capital", "FalcÃ³n", "GuÃ¡rico", "La Guaira",
  "Lara", "MÃ©rida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre",
  "TÃ¡chira", "Trujillo", "Yaracuy", "Zulia"
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

  // ðŸ’¡ ESTADOS DE PAGINACIÃ“N (Configurado a 13 elementos por pÃ¡gina)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 13;

  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
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

  // Si el usuario busca algo, lo devolvemos a la pÃ¡gina 1
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

  const handleCreateNew = (): void => { setOpenDropdownId(null); setEditingId(null); setFormProv(initialForm); setIsModalOpen(true); };
  const handleViewDetails = (prov: Proveedor): void => { setOpenDropdownId(null); setSelectedProvDetails(prov); setDetailsModalOpen(true); };

  const handleEdit = (prov: Proveedor): void => {
    setOpenDropdownId(null);
    setEditingId(prov.id);
    setFormProv({
      identificador: prov.identificador, nombre: prov.nombre, email: prov.email || '', rubro: prov.rubro || '',
      telefono1: prov.telefono1 || '', telefono2: prov.telefono2 || '', direccion: prov.direccion || '', estado_venezuela: prov.estado_venezuela || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number, nombre: string): Promise<void> => {
    setOpenDropdownId(null);
    const ok = await showConfirm({
      title: 'Eliminar proveedor',
      message: `Â¿EstÃ¡ seguro de que desea eliminar a "${nombre}" del directorio? Sus facturas pasadas se mantendrÃ¡n intactas.`,
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
    if (!isValidCedulaRif(formProv.identificador)) return alert('Error: el RIF/CÃ©dula debe iniciar con V, E, J o G y contener solo nÃºmeros.');
    if (formProv.email && !isValidEmail(formProv.email)) return alert('Error: el correo del proveedor no tiene un formato valido.');
    if (!isValidPhone(formProv.telefono1)) return alert('Error: el telÃ©fono principal debe tener solo nÃºmeros.');
    if (formProv.telefono2 && !isValidPhone(formProv.telefono2)) return alert('Error: el telÃ©fono secundario debe tener solo nÃºmeros.');
    try {
      const token = localStorage.getItem('habioo_token');
      const url = editingId ? `${API_BASE_URL}/proveedores/${editingId}` : `${API_BASE_URL}/proveedores`;
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(formProv) });
      const data = await res.json() as ApiActionResponse;
      if (data.status === 'success') { alert(data.message); setFormProv(initialForm); setIsModalOpen(false); void fetchProveedores(); }
      else { alert(data.error || data.message || 'Error al guardar proveedor'); }
    } catch (_error: unknown) { alert('Error de conexiÃ³n al servidor.'); }
  };

  // ==========================================
  // FUNCIONES DE CARGA MASIVA DE PROVEEDORES
  // ==========================================
  const handleDownloadTemplate = (): void => {
    const data = [
      { RIF: 'J123456789', Nombre: 'FerreterÃ­a El Clavo', Email: 'contacto@elclavo.com', Rubro: 'FerreterÃ­a', Telefono1: '04141234567', Telefono2: '', Estado: 'Distrito Capital', Direccion: 'Av. Principal, Edificio Torre 1' },
      { RIF: 'V87654321', Nombre: 'Juan PÃ©rez PlomerÃ­a', Email: 'jp.plomeria@gmail.com', Rubro: 'PlomerÃ­a', Telefono1: '04129876543', Telefono2: '04161234567', Estado: 'Miranda', Direccion: 'Calle 4, Local 2' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);

    if (ws['A1']) ws['A1'].c = [{ a: 'Sistema', t: 'Obligatorio. Letra mayÃºscula inicial.' }];
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
        const nombre = row['Nombre'] || row['RazÃ³n Social'] || row['Razon Social'] || '';
        const email = row['Email'] || row['Correo'] || row['Correo ElectrÃ³nico'] || row['Correo Electronico'] || '';
        const rubro = row['Rubro'] || row['Especialidad'] || '';
        const tel1 = row['Telefono1'] || row['TelÃ©fono1'] || row['TelÃ©fono Principal'] || row['Telefono Principal'] || row['Telefono'] || '';
        const tel2 = row['Telefono2'] || row['TelÃ©fono2'] || row['TelÃ©fono Secundario'] || '';
        const estado = row['Estado'] || '';
        const direccion = row['Direccion'] || row['DirecciÃ³n'] || '';

        const rifFmt = sanitizeCedulaRif(String(rifRaw));
        const emailFmt = sanitizeEmail(String(email));
        const emailOk = !emailFmt || isValidEmail(emailFmt);
        const tel1Fmt = sanitizePhone(String(tel1));
        const tel2Fmt = sanitizePhone(String(tel2));

        const errorMsg: string[] = [];
        if (!rifFmt) errorMsg.push("RIF invÃ¡lido");
        if (!nombre) errorMsg.push("Nombre vacÃ­o");
        if (!emailOk) errorMsg.push('Correo invalido');
        if (!tel1Fmt) errorMsg.push("TelÃ©fono principal requerido");
        if (tel1Fmt && !isValidPhone(tel1Fmt)) errorMsg.push("TelÃ©fono principal invÃ¡lido");
        if (tel2Fmt && !isValidPhone(tel2Fmt)) errorMsg.push("TelÃ©fono secundario invÃ¡lido");
        if (!estado || !ESTADOS_VENEZUELA.includes(String(estado))) errorMsg.push("Estado invÃ¡lido");
        if (!direccion) errorMsg.push("DirecciÃ³n vacÃ­a");

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
      message: `Â¿EstÃ¡ seguro de importar ${loteData.length} proveedores?`,
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
      clearInterval(progressInterval); setIsUploadingLote(false); setUploadProgress(0); alert("Error de conexiÃ³n al cargar lote.");
    }
  };

  // ðŸ’¡ LÃ“GICA DE FILTRADO Y PAGINACIÃ“N
  const filteredProveedores = proveedores.filter((p: Proveedor) =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.rubro && p.rubro.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProveedores.length / itemsPerPage);

  // Extraemos solo los proveedores que corresponden a la pÃ¡gina actual
  const currentProveedores = filteredProveedores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (userRole !== 'Administrador') { return <section className="p-6"><p>No tienes permisos para gestionar proveedores.</p></section>; }

  return (
    <div className="space-y-6 relative" onClick={() => setOpenDropdownId(null)}>
      {/* ENCABEZADO */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white whitespace-nowrap">ðŸ¢ Directorio Proveedores</h3>

        <div className="flex-1 w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">ðŸ”</span>
          <input type="text" placeholder="Buscar por nombre, RIF, correo o rubro..." value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
        </div>

        <div className="flex gap-3 w-full xl:w-auto">
          <button onClick={() => setLoteModalOpen(true)} className="flex-1 xl:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:border-blue-800/50 dark:text-blue-400 font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-sm flex items-center justify-center gap-2">
            ðŸ“¦ Carga Masiva
          </button>
          <button onClick={handleCreateNew} className="flex-1 xl:flex-none bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md text-sm whitespace-nowrap">
            + Nuevo Proveedor
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 p-6">Cargando directorio...</p> : currentProveedores.length === 0 ? <p className="text-gray-500 text-center py-10">No se encontraron proveedores activos.</p> : (
          <>
            <div className="w-full pb-32">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-donezo-card-dark z-20 shadow-sm">
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="py-4 pr-3 pl-6">RIF / Identificador</th>
                    <th className="py-4 px-3">Nombre y Rubro</th>
                    <th className="py-4 px-3">TelÃ©fonos</th>
                    <th className="py-4 pl-3 pr-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ðŸ’¡ MAPEO SOBRE LOS PROVEEDORES DE LA PÃGINA ACTUAL */}
                  {currentProveedores.map((p: Proveedor) => (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 pr-3 pl-6 font-mono font-medium text-gray-600 dark:text-gray-400">{p.identificador}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-800 dark:text-white text-base">{p.nombre}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{p.email || 'Sin correo'}</div>
                        {p.rubro && <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase">{p.rubro}</span>}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400 text-sm">
                        {p.telefono1} {p.telefono2 && <><br /><span className="text-gray-400 text-xs">{p.telefono2}</span></>}
                      </td>

                      <td className="py-3 pl-3 pr-6 text-center relative">
                        <button onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">
                          Opciones <span className="text-[9px]">â–¼</span>
                        </button>

                        {openDropdownId === p.id && (
                          <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-fadeIn">
                            <button onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleViewDetails(p); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400 font-bold transition-colors border-b border-gray-50 dark:border-gray-700">ðŸ‘ï¸ Ver Detalles</button>
                            <button onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 transition-colors">âœï¸ Editar Datos</button>
                            <button onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); void handleDelete(p.id, p.nombre); }} className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 font-bold transition-colors">ðŸ—‘ï¸ Eliminar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ðŸ’¡ CONTROLES DE PAGINACIÃ“N */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
                <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  â† Anterior
                </button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">PÃ¡gina {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  Siguiente â†’
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
