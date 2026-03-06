import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

const ESTADOS_VENEZUELA = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo",
  "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "La Guaira",
  "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre",
  "Táchira", "Trujillo", "Yaracuy", "Zulia"
];

export default function Proveedores() {
  const { user, userRole } = useOutletContext();
  const [proveedores, setProveedores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); 

  const [formProv, setFormProv] = useState({
    identificador: '', nombre: '', telefono1: '', telefono2: '', direccion: '', estado_venezuela: ''
  });

  const fetchProveedores = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch('https://auth.habioo.cloud/proveedores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setProveedores(data.proveedores);
      }
    } catch (error) {
      console.error("Error al cargar proveedores", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') {
      fetchProveedores();
    }
  }, [userRole]);

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

  const handleRegistrarProveedor = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch('https://auth.habioo.cloud/proveedores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formProv)
      });

      const data = await response.json();

      if (data.status === 'success') {
        alert('Proveedor registrado con éxito');
        setFormProv({ identificador: '', nombre: '', telefono1: '', telefono2: '', direccion: '', estado_venezuela: '' });
        setIsModalOpen(false);
        fetchProveedores();
      } else {
        alert(data.message || 'Error al registrar proveedor');
      }
    } catch (error) {
      alert('Error de conexión al registrar proveedor');
    }
  };

  const filteredProveedores = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.identificador.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userRole !== 'Administrador') {
    return (
      <section className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
        <p className="text-gray-600 dark:text-gray-300">{user?.nombre}, no tienes permisos para gestionar proveedores.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏢 Directorio de Proveedores</h3>
        
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por nombre o RIF..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
          />
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap"
        >
          + Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Cargando directorio...</p>
        ) : filteredProveedores.length === 0 ? (
          <p className="text-gray-500 text-center py-4 dark:text-gray-400">No se encontraron proveedores.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <th className="p-3">RIF / Identificador</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Teléfonos</th>
                  <th className="p-3">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {filteredProveedores.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 font-medium text-gray-600 dark:text-gray-400">{p.identificador}</td>
                    <td className="p-3 font-bold text-gray-800 dark:text-white">{p.nombre}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400 text-sm">
                      {p.telefono1} {p.telefono2 && <><br /><span className="text-gray-400">{p.telefono2}</span></>}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400 text-sm max-w-xs">
                      <span className="font-semibold block text-gray-800 dark:text-gray-200">{p.estado_venezuela || 'N/A'}</span>
                      <span className="truncate block" title={p.direccion}>{p.direccion || 'N/A'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Registrar Proveedor</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Los campos marcados con (<span className="text-red-500">*</span>) son obligatorios.</p>
            
            <form onSubmit={handleRegistrarProveedor} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identificador <span className="text-red-500">*</span></label>
                <input type="text" name="identificador" value={formProv.identificador} onChange={handleProvChange} placeholder="Ej: J123456789" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre / Razón Social <span className="text-red-500">*</span></label>
                <input type="text" name="nombre" value={formProv.nombre} onChange={handleProvChange} placeholder="Ej: Ferretería El Clavo" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono Principal <span className="text-red-500">*</span></label>
                <input type="text" name="telefono1" value={formProv.telefono1} onChange={handleProvChange} placeholder="Ej: 0414-1234567" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono Secundario</label>
                <input type="text" name="telefono2" value={formProv.telefono2} onChange={handleProvChange} placeholder="Opcional" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado de Venezuela <span className="text-red-500">*</span></label>
                <select name="estado_venezuela" value={formProv.estado_venezuela} onChange={handleProvChange} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required>
                  <option value="">Seleccione un Estado...</option>
                  {ESTADOS_VENEZUELA.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección Física Exacta <span className="text-red-500">*</span></label>
                <textarea name="direccion" value={formProv.direccion} onChange={handleProvChange} placeholder="Ej: Av. Principal, Torre Norte, Local 4" rows="2" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
              </div>
              
              <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-all">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 transition-all shadow-md">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}