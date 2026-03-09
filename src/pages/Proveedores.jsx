import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { ModalProveedorForm, ModalProveedorDetails } from '../components/proveedores/ProveedoresModals'; // 💡 Importamos ambas modales

export default function Proveedores() {
  const { user, userRole } = useOutletContext();
  const [proveedores, setProveedores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); 

  // 💡 ESTADOS PARA EL DROPDOWN Y LA MODAL DE DETALLES
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedProvDetails, setSelectedProvDetails] = useState(null);

  const [editingId, setEditingId] = useState(null);

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

  const handleCreateNew = () => {
    setOpenDropdownId(null);
    setEditingId(null);
    setFormProv(initialForm);
    setIsModalOpen(true);
  };

  // 💡 NUEVO HANDLER PARA VER DETALLES
  const handleViewDetails = (prov) => {
    setOpenDropdownId(null);
    setSelectedProvDetails(prov);
    setDetailsModalOpen(true);
  };

  const handleEdit = (prov) => {
    setOpenDropdownId(null);
    setEditingId(prov.id);
    setFormProv({
      identificador: prov.identificador,
      nombre: prov.nombre,
      rubro: prov.rubro || '',
      telefono1: prov.telefono1 || '',
      telefono2: prov.telefono2 || '',
      direccion: prov.direccion || '',
      estado_venezuela: prov.estado_venezuela || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id, nombre) => {
    setOpenDropdownId(null);
    if (!confirm(`¿Está seguro de que desea eliminar a "${nombre}" del directorio? Sus facturas pasadas se mantendrán intactas.`)) return;

    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/proveedores/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchProveedores();
      } else { alert(data.error); }
    } catch (err) { alert('Error al eliminar proveedor'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('habioo_token');
      const url = editingId ? `${API_BASE_URL}/proveedores/${editingId}` : `${API_BASE_URL}/proveedores`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formProv)
      });

      const data = await response.json();

      if (data.status === 'success') {
        alert(data.message);
        setFormProv(initialForm);
        setIsModalOpen(false);
        fetchProveedores();
      } else {
        alert(data.error || data.message || 'Error al guardar proveedor');
      }
    } catch (error) {
      alert('Error de conexión al servidor.');
    }
  };

  const filteredProveedores = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.rubro && p.rubro.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (userRole !== 'Administrador') {
    return <section className="p-6"><p>No tienes permisos para gestionar proveedores.</p></section>;
  }

  return (
    // 💡 El onClick general permite cerrar el dropdown si haces click en cualquier otro lado
    <div className="space-y-6 relative" onClick={() => setOpenDropdownId(null)}>
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white whitespace-nowrap">🏢 Directorio de Proveedores</h3>
        
        <div className="flex-1 w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, RIF o Rubro..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
          />
        </div>

        <button 
          onClick={handleCreateNew}
          className="w-full sm:w-auto bg-donezo-primary hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all whitespace-nowrap shadow-md"
        >
          + Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? (
          <p className="text-gray-500 p-6">Cargando directorio...</p>
        ) : filteredProveedores.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No se encontraron proveedores activos.</p>
        ) : (
          <div className="overflow-x-auto pb-32 pt-2 px-6"> {/* 💡 pb-32 asegura que el menú no se corte en la última fila */}
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
                {filteredProveedores.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 pr-3 font-mono font-medium text-gray-600 dark:text-gray-400">{p.identificador}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-gray-800 dark:text-white text-base">{p.nombre}</div>
                      {p.rubro && <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase">{p.rubro}</span>}
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400 text-sm">
                      {p.telefono1} {p.telefono2 && <><br /><span className="text-gray-400 text-xs">{p.telefono2}</span></>}
                    </td>
                    
                    {/* 💡 DROPDOWN DE OPCIONES */}
                    <td className="py-3 pl-3 text-center relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id); }} 
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
                      >
                        Opciones <span className="text-[9px]">▼</span>
                      </button>
                      
                      {openDropdownId === p.id && (
                        <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-fadeIn">
                          <button onClick={(e) => { e.stopPropagation(); handleViewDetails(p); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400 font-bold transition-colors border-b border-gray-50 dark:border-gray-700">
                            👁️ Ver Detalles
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 transition-colors">
                            ✏️ Editar Datos
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.nombre); }} className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 font-bold transition-colors">
                            🗑️ Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 💡 MODAL DE FORMULARIO IMPORTADA */}
      <ModalProveedorForm
        isOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editingId={editingId}
        formProv={formProv}
        setFormProv={setFormProv}
        handleProvChange={handleProvChange}
        handleSubmit={handleSubmit}
      />

      {/* 💡 NUEVA MODAL DE DETALLES IMPORTADA */}
      <ModalProveedorDetails 
        isOpen={detailsModalOpen}
        setIsOpen={setDetailsModalOpen}
        prov={selectedProvDetails}
      />

    </div>
  );
}