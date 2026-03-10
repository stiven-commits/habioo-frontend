import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';
import { ModalProveedorForm, ModalProveedorDetails, ModalCargaMasivaProveedores } from '../components/proveedores/ProveedoresModals'; 
import { useDialog } from '../components/ui/DialogProvider';

const ESTADOS_VENEZUELA = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo",
  "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "La Guaira",
  "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre",
  "Táchira", "Trujillo", "Yaracuy", "Zulia"
];

export default function Proveedores() {
  const { user, userRole } = useOutletContext();
  const { showConfirm } = useDialog();
  const [proveedores, setProveedores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); 

  // 💡 ESTADOS DE PAGINACIÓN (Configurado a 13 elementos por página)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 13;

  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedProvDetails, setSelectedProvDetails] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // ESTADOS PARA CARGA MASIVA DE PROVEEDORES
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [loteData, setLoteData] = useState([]);
  const [loteErrors, setLoteErrors] = useState(0);
  const [isUploadingLote, setIsUploadingLote] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const initialForm = {
    identificador: '', nombre: '', rubro: '', telefono1: '', telefono2: '', direccion: '', estado_venezuela: ''
  };
  const [formProv, setFormProv] = useState(initialForm);

  const fetchProveedores = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/proveedores`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setProveedores(data.proveedores);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchProveedores(); }, [userRole]);

  // Si el usuario busca algo, lo devolvemos a la página 1
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const formatRIF = (val) => {
    let raw = val.toUpperCase().replace(/[^VEJPG0-9]/g, '');
    if (!raw) return '';
    const letra = raw.charAt(0);
    if (!['V', 'E', 'J', 'P', 'G'].includes(letra)) return ''; 
    const numeros = raw.slice(1).replace(/[^0-9]/g, '').slice(0, 9);
    return `${letra}${numeros}`;
  };

  const handleProvChange = (e) => {
    const { name, value } = e.target;
    if (name === 'identificador') {
      setFormProv({ ...formProv, [name]: formatRIF(value) });
    } else {
      setFormProv({ ...formProv, [name]: value });
    }
  };

  const handleCreateNew = () => { setOpenDropdownId(null); setEditingId(null); setFormProv(initialForm); setIsModalOpen(true); };
  const handleViewDetails = (prov) => { setOpenDropdownId(null); setSelectedProvDetails(prov); setDetailsModalOpen(true); };
  
  const handleEdit = (prov) => {
    setOpenDropdownId(null);
    setEditingId(prov.id);
    setFormProv({
      identificador: prov.identificador, nombre: prov.nombre, rubro: prov.rubro || '',
      telefono1: prov.telefono1 || '', telefono2: prov.telefono2 || '', direccion: prov.direccion || '', estado_venezuela: prov.estado_venezuela || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, nombre) => {
    setOpenDropdownId(null);
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
      const data = await res.json();
      if (data.status === 'success') fetchProveedores();
      else alert(data.error);
    } catch (err) { alert('Error al eliminar proveedor'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('habioo_token');
      const url = editingId ? `${API_BASE_URL}/proveedores/${editingId}` : `${API_BASE_URL}/proveedores`;
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(formProv) });
      const data = await res.json();
      if (data.status === 'success') { alert(data.message); setFormProv(initialForm); setIsModalOpen(false); fetchProveedores(); } 
      else { alert(data.error || data.message || 'Error al guardar proveedor'); }
    } catch (error) { alert('Error de conexión al servidor.'); }
  };

  // ==========================================
  // FUNCIONES DE CARGA MASIVA DE PROVEEDORES
  // ==========================================
  const handleDownloadTemplate = () => {
    const data = [
      { RIF: 'J123456789', Nombre: 'Ferretería El Clavo', Rubro: 'Ferretería', Telefono1: '04141234567', Telefono2: '', Estado: 'Distrito Capital', Direccion: 'Av. Principal, Edificio Torre 1' },
      { RIF: 'V87654321', Nombre: 'Juan Pérez Plomería', Rubro: 'Plomería', Telefono1: '04129876543', Telefono2: '04161234567', Estado: 'Miranda', Direccion: 'Calle 4, Local 2' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);

    if (ws['A1']) ws['A1'].c = [{ a: 'Sistema', t: 'Obligatorio. Letra mayúscula inicial.' }];
    if (ws['C1']) ws['C1'].c = [{ a: 'Sistema', t: 'Opcional. Trate de escribir un rubro conocido (ej: Electricistas, Seguridad).' }];
    if (ws['D1']) ws['D1'].c = [{ a: 'Sistema', t: 'Obligatorio.' }];
    if (ws['F1']) ws['F1'].c = [{ a: 'Sistema', t: 'Obligatorio. Debe estar escrito igual a la lista oficial (Ej: Distrito Capital, Zulia, Miranda).' }];

    ws['!cols'] = [ {wch: 15}, {wch: 30}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 40} ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
    XLSX.writeFile(wb, "Plantilla_Habioo_Proveedores.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      let errCount = 0;
      let seenRIFs = new Set(); 

      const parsedData = rawData.map((row, index) => {
        const rifRaw = row['RIF'] || row['Identificador'] || '';
        const nombre = row['Nombre'] || row['Razón Social'] || row['Razon Social'] || '';
        const rubro = row['Rubro'] || row['Especialidad'] || '';
        const tel1 = row['Telefono1'] || row['Teléfono1'] || row['Teléfono Principal'] || row['Telefono Principal'] || row['Telefono'] || '';
        const tel2 = row['Telefono2'] || row['Teléfono2'] || row['Teléfono Secundario'] || '';
        const estado = row['Estado'] || '';
        const direccion = row['Direccion'] || row['Dirección'] || '';

        const rifFmt = formatRIF(String(rifRaw));

        let errorMsg = [];
        if (!rifFmt) errorMsg.push("RIF inválido");
        if (!nombre) errorMsg.push("Nombre vacío");
        if (!tel1) errorMsg.push("Teléfono principal requerido");
        if (!estado || !ESTADOS_VENEZUELA.includes(estado)) errorMsg.push("Estado inválido");
        if (!direccion) errorMsg.push("Dirección vacía");
        
        if (rifFmt) {
           if (seenRIFs.has(rifFmt)) { errorMsg.push("RIF duplicado en el archivo"); } 
           else { seenRIFs.add(rifFmt); }
        }

        if (errorMsg.length > 0) errCount++;

        return {
          rowNum: index + 2,
          identificador: rifFmt,
          nombre: String(nombre).trim(),
          rubro: String(rubro).trim(),
          telefono1: String(tel1).trim(),
          telefono2: String(tel2).trim(),
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
    e.target.value = null; 
  };

  const handleSaveLote = async () => {
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

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
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
      const data = await res.json();
      
      if (data.status === 'success') {
        setUploadProgress(100); 
        setTimeout(() => {
          alert(data.message); setLoteModalOpen(false); setLoteData([]); fetchProveedores(); setIsUploadingLote(false); setUploadProgress(0);
        }, 500);
      } else { 
        setIsUploadingLote(false); setUploadProgress(0); alert("Error: " + (data.error || data.message)); 
      }
    } catch (err) { 
      clearInterval(progressInterval); setIsUploadingLote(false); setUploadProgress(0); alert("Error de conexión al cargar lote."); 
    } 
  };

  // 💡 LÓGICA DE FILTRADO Y PAGINACIÓN
  const filteredProveedores = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    <div className="space-y-6 relative" onClick={() => setOpenDropdownId(null)}>
      {/* ENCABEZADO */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white whitespace-nowrap">🏢 Directorio Proveedores</h3>
        
        <div className="flex-1 w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input type="text" placeholder="Buscar por nombre, RIF o Rubro..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
        </div>

        <div className="flex gap-3 w-full xl:w-auto">
          <button onClick={() => setLoteModalOpen(true)} className="flex-1 xl:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:border-blue-800/50 dark:text-blue-400 font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-sm flex items-center justify-center gap-2">
            📦 Carga Masiva
          </button>
          <button onClick={handleCreateNew} className="flex-1 xl:flex-none bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md text-sm whitespace-nowrap">
            + Nuevo Proveedor
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 p-6">Cargando directorio...</p> : currentProveedores.length === 0 ? <p className="text-gray-500 text-center py-10">No se encontraron proveedores activos.</p> : (
          <>
            <div className="overflow-x-auto pb-32 pt-2 px-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="py-4 pr-3">RIF / Identificador</th>
                    <th className="py-4 px-3">Nombre y Rubro</th>
                    <th className="py-4 px-3">Teléfonos</th>
                    <th className="py-4 pl-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 💡 MAPEO SOBRE LOS PROVEEDORES DE LA PÁGINA ACTUAL */}
                  {currentProveedores.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 pr-3 font-mono font-medium text-gray-600 dark:text-gray-400">{p.identificador}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-800 dark:text-white text-base">{p.nombre}</div>
                        {p.rubro && <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase">{p.rubro}</span>}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400 text-sm">
                        {p.telefono1} {p.telefono2 && <><br /><span className="text-gray-400 text-xs">{p.telefono2}</span></>}
                      </td>
                      
                      <td className="py-3 pl-3 text-center relative">
                        <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">
                          Opciones <span className="text-[9px]">▼</span>
                        </button>
                        
                        {openDropdownId === p.id && (
                          <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-fadeIn">
                            <button onClick={(e) => { e.stopPropagation(); handleViewDetails(p); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400 font-bold transition-colors border-b border-gray-50 dark:border-gray-700">👁️ Ver Detalles</button>
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 transition-colors">✏️ Editar Datos</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.nombre); }} className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 font-bold transition-colors">🗑️ Eliminar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 💡 CONTROLES DE PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  ← Anterior
                </button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALES IMPORTADAS */}
      <ModalProveedorForm isOpen={isModalOpen} setIsModalOpen={setIsModalOpen} editingId={editingId} formProv={formProv} setFormProv={setFormProv} handleProvChange={handleProvChange} handleSubmit={handleSubmit} />
      <ModalProveedorDetails isOpen={detailsModalOpen} setIsOpen={setDetailsModalOpen} prov={selectedProvDetails} />
      
      <ModalCargaMasivaProveedores 
        isOpen={loteModalOpen} setLoteModalOpen={setLoteModalOpen} loteData={loteData} setLoteData={setLoteData} loteErrors={loteErrors}
        isUploadingLote={isUploadingLote} uploadProgress={uploadProgress} handleDownloadTemplate={handleDownloadTemplate} handleSaveLote={handleSaveLote} handleFileUpload={handleFileUpload}
      />
    </div>
  );
}
