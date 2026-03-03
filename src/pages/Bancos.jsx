import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Bancos() {
  const { userRole } = useOutletContext();
  const [bancos, setBancos] = useState([]);
  const [form, setForm] = useState({ numero_cuenta: '', nombre_banco: '', apodo: '' });

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/bancos', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.status === 'success') setBancos(data.bancos);
  };

  useEffect(() => { if (userRole === 'Administrador') fetchData(); }, [userRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/bancos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setForm({ numero_cuenta: '', nombre_banco: '', apodo: '' });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Eliminar cuenta?")) return;
    const token = localStorage.getItem('habioo_token');
    await fetch(`https://auth.habioo.cloud/bancos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  if (userRole !== 'Administrador') return <p>Acceso denegado.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">💳 Registrar Nueva Cuenta</h3>
        <form onSubmit={handleSubmit} className="flex gap-4 flex-wrap">
          <input type="text" placeholder="Banco (Ej: Banesco)" value={form.nombre_banco} onChange={e => setForm({...form, nombre_banco: e.target.value})} className="flex-1 p-3 rounded-xl border dark:bg-gray-800 dark:text-white" required />
          <input type="text" placeholder="Número (Ej: 0134-...)" value={form.numero_cuenta} onChange={e => setForm({...form, numero_cuenta: e.target.value})} className="flex-1 p-3 rounded-xl border dark:bg-gray-800 dark:text-white" required />
          <input type="text" placeholder="Apodo (Ej: Principal)" value={form.apodo} onChange={e => setForm({...form, apodo: e.target.value})} className="w-40 p-3 rounded-xl border dark:bg-gray-800 dark:text-white" required />
          <button type="submit" className="bg-donezo-primary text-white font-bold px-6 rounded-xl hover:bg-green-700">+ Agregar</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bancos.map(b => (
          <div key={b.id} className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white">{b.nombre_banco}</h4>
              <p className="text-gray-500 text-sm font-mono my-1">{b.numero_cuenta}</p>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-lg">{b.apodo}</span>
            </div>
            <button onClick={() => handleDelete(b.id)} className="text-red-300 hover:text-red-500 text-xl">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}