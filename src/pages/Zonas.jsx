import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Zonas() {
  const { userRole } = useOutletContext();
  const [zonas, setZonas] = useState([]);
  const [allProps, setAllProps] = useState([]); // Lista de todos los aptos disponibles
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ nombre: '', propiedades_ids: [] });

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/zonas', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') {
        setZonas(data.zonas);
        setAllProps(data.todas_propiedades);
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchData(); }, [userRole]);

  // Maneja la selección múltiple de apartamentos
  const togglePropiedad = (id) => {
    setForm(prev => {
      const exists = prev.propiedades_ids.includes(id);
      return {
        ...prev,
        propiedades_ids: exists 
          ? prev.propiedades_ids.filter(pid => pid !== id) // Quitar
          : [...prev.propiedades_ids, id] // Agregar
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.propiedades_ids.length === 0) return alert("Selecciona al menos una propiedad");

    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/zonas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert(data.message);
      setIsModalOpen(false);
      setForm({ nombre: '', propiedades_ids: [] });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Borrar zona? Los gastos asociados podrían quedar huérfanos.")) return;
    const token = localStorage.getItem('habioo_token');
    await fetch(`https://auth.habioo.cloud/zonas/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  if (userRole !== 'Administrador') return <p className="p-6">Acceso denegado.</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏢 Zonificación del Condominio</h3>
        <button onClick={() => setIsModalOpen(true)} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all">+ Crear Zona</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zonas.map(z => (
          <div key={z.id} className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative group">
            <button onClick={() => handleDelete(z.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">🗑️</button>
            <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">{z.nombre}</h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl h-32 overflow-y-auto">
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Propiedades Asignadas ({z.propiedades.length})</p>
              <div className="flex flex-wrap gap-2">
                {z.propiedades.map(p => (
                  <span key={p.id} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md text-xs font-medium dark:text-gray-300">
                    {p.identificador}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Nueva Zona / Etapa</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre de la Zona</label>
                <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej: Torre A, Locales Comerciales..." className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none dark:text-white" required />
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-sm font-bold text-gray-500 mb-3">Selecciona los inmuebles que pertenecen a esta zona:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allProps.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => togglePropiedad(p.id)}
                      className={`p-2 rounded-lg border text-sm font-medium cursor-pointer transition-all flex items-center gap-2
                        ${form.propiedades_ids.includes(p.id) 
                          ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-donezo-primary'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${form.propiedades_ids.includes(p.id) ? 'bg-donezo-primary border-transparent' : 'border-gray-400'}`}>
                        {form.propiedades_ids.includes(p.id) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      {p.identificador}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 dark:text-gray-300">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl bg-donezo-primary text-white font-bold hover:bg-green-700 shadow-md">Guardar Zona</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}