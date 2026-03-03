import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Propiedades() {
  const { userRole } = useOutletContext();
  const [propiedades, setPropiedades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para saber si estamos editando (null = creando)
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    identificador: '', alicuota: '',
    prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '',
    tiene_inquilino: false,
    inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: ''
  };

  const [form, setForm] = useState(initialForm);

  const fetchPropiedades = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch('https://auth.habioo.cloud/propiedades-admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchPropiedades();
  }, [userRole]);

  const formatCedula = (val) => {
    let raw = val.toUpperCase().replace(/[^VEJPG0-9]/g, '');
    if (!raw) return '';
    const letra = raw.charAt(0);
    if (!['V', 'E', 'J', 'P', 'G'].includes(letra)) return '';
    const numeros = raw.slice(1).replace(/[^0-9]/g, '').slice(0, 9);
    return `${letra}${numeros}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setForm({ ...form, [name]: checked });
    } else if (name === 'prop_cedula' || name === 'inq_cedula') {
      setForm({ ...form, [name]: formatCedula(value) });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleEdit = (prop) => {
    setEditingId(prop.id);
    setForm({
      identificador: prop.identificador,
      alicuota: prop.alicuota,
      prop_nombre: prop.prop_nombre || '',
      prop_cedula: prop.prop_cedula || '',
      prop_email: prop.prop_email || '',
      prop_telefono: prop.prop_telefono || '',
      prop_password: '', // Siempre limpia por seguridad
      tiene_inquilino: !!prop.inq_cedula, // Si tiene cédula de inquilino, activa el check
      inq_nombre: prop.inq_nombre || '',
      inq_cedula: prop.inq_cedula || '',
      inq_email: prop.inq_email || '',
      inq_telefono: prop.inq_telefono || '',
      inq_password: ''
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    
    // Decidimos si es POST (Crear) o PUT (Editar)
    const url = editingId 
      ? `https://auth.habioo.cloud/propiedades-admin/${editingId}`
      : 'https://auth.habioo.cloud/propiedades-admin';
    
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert(data.message);
      setIsModalOpen(false);
      fetchPropiedades();
    } else {
      alert(data.message);
    }
  };

  const filteredProps = propiedades.filter(p => 
    p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏠 Inmuebles y Residentes</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input 
            type="text" placeholder="Buscar apartamento o propietario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
          />
        </div>
        <button onClick={handleCreateNew} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all whitespace-nowrap">
          + Registrar Inmueble
        </button>
      </div>

      {/* TABLA */}
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500">Cargando...</p> : filteredProps.length === 0 ? <p className="text-gray-500 text-center py-4">No hay inmuebles registrados.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                  <th className="p-3">Inmueble</th>
                  <th className="p-3 text-right">Alícuota</th>
                  <th className="p-3">Propietario</th>
                  <th className="p-3">Contacto</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProps.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 font-bold text-gray-800 dark:text-white">{p.identificador}</td>
                    <td className="p-3 text-right font-mono text-donezo-primary">{p.alicuota}%</td>
                    <td className="p-3">
                      <div className="font-medium text-gray-800 dark:text-gray-300">{p.prop_nombre}</div>
                      <div className="text-xs text-gray-400">{p.prop_cedula}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                      <div>{p.prop_telefono || '-'}</div>
                      <div className="text-xs">{p.prop_email || '-'}</div>
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 p-2 rounded-lg transition-colors" 
                        title="Editar Datos"
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE REGISTRO / EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
              {editingId ? '✏️ Editar Inmueble' : '🏠 Nuevo Inmueble'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECCIÓN 1: EL APARTAMENTO */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-donezo-primary mb-3">1. Datos del Inmueble</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identificador <span className="text-red-500">*</span></label>
                    <input type="text" name="identificador" value={form.identificador} onChange={handleChange} placeholder="Ej: Apto 5B" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alícuota (%) <span className="text-red-500">*</span></label>
                    <input type="text" name="alicuota" value={form.alicuota} onChange={handleChange} placeholder="Ej: 2.55" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: EL PROPIETARIO */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-blue-600 mb-3">2. Datos del Propietario (Login)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cédula (Usuario) <span className="text-red-500">*</span></label>
                    <input type="text" name="prop_cedula" value={form.prop_cedula} onChange={handleChange} placeholder="Ej: V12345678" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                    <input type="text" name="prop_nombre" value={form.prop_nombre} onChange={handleChange} placeholder="Ej: Juan Pérez" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" name="prop_email" value={form.prop_email} onChange={handleChange} placeholder="juan@gmail.com" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                    <input type="text" name="prop_telefono" value={form.prop_telefono} onChange={handleChange} placeholder="0414-1234567" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  </div>
                  
                  {/* CAMPO DE CLAVE SOLO EN EDICIÓN */}
                  {editingId && (
                    <div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <label className="block text-sm font-bold text-yellow-800 dark:text-yellow-500 mb-1">🔑 Restablecer Contraseña (Opcional)</label>
                      <input type="password" name="prop_password" value={form.prop_password} onChange={handleChange} placeholder="Escriba nueva clave solo si desea cambiarla" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: EL INQUILINO */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <input type="checkbox" name="tiene_inquilino" checked={form.tiene_inquilino} onChange={handleChange} className="w-5 h-5 text-donezo-primary" />
                  <h4 className="font-bold text-gray-700 dark:text-gray-300">¿Tiene Inquilino Residente?</h4>
                </div>
                
                {form.tiene_inquilino && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cédula Inquilino <span className="text-red-500">*</span></label>
                      <input type="text" name="inq_cedula" value={form.inq_cedula} onChange={handleChange} placeholder="Ej: V98765432" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Inquilino <span className="text-red-500">*</span></label>
                      <input type="text" name="inq_nombre" value={form.inq_nombre} onChange={handleChange} placeholder="Ej: María López" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input type="email" name="inq_email" value={form.inq_email} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                      <input type="text" name="inq_telefono" value={form.inq_telefono} onChange={handleChange} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                    </div>

                    {/* CAMPO DE CLAVE SOLO EN EDICIÓN */}
                    {editingId && (
                      <div className="md:col-span-2 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <label className="block text-sm font-bold text-yellow-800 dark:text-yellow-500 mb-1">🔑 Restablecer Contraseña Inquilino</label>
                        <input type="password" name="inq_password" value={form.inq_password} onChange={handleChange} placeholder="Nueva clave..." className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl font-bold bg-donezo-primary text-white hover:bg-green-700 shadow-md">
                  {editingId ? 'Guardar Cambios' : 'Registrar Todo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}