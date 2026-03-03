import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Bancos() {
  const { userRole } = useOutletContext();
  const [bancos, setBancos] = useState([]);
  const [form, setForm] = useState({ 
    numero_cuenta: '', nombre_banco: '', apodo: '', tipo: 'Transferencia Bs' 
  });

  const TIPOS_PAGO = [
    "Transferencia Bs", "Pago Móvil", "Zelle", "Efectivo USD", "Efectivo EUR", "Banesco Panamá", "Paypal"
  ];

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/bancos', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.status === 'success') setBancos(data.bancos);
  };

  useEffect(() => { if (userRole === 'Administrador') fetchData(); }, [userRole]);

  // Lógica para saber qué mostrar según el tipo
  const isCash = form.tipo.includes('Efectivo');
  const isDigital = ['Zelle', 'Paypal'].includes(form.tipo); // Solo correo/tlf, sin banco
  const isBank = !isCash && !isDigital; // Bancos tradicionales

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');

    // PREPARAR DATOS AUTOMÁTICOS PARA LA BD (Rellenar huecos)
    let payload = { ...form };

    if (isCash) {
      payload.nombre_banco = 'Caja Fuerte / Oficina';
      payload.numero_cuenta = 'N/A'; // No aplica
    } else if (isDigital) {
      payload.nombre_banco = form.tipo; // El banco es "Zelle" o "Paypal"
    }

    const res = await fetch('https://auth.habioo.cloud/bancos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setForm({ numero_cuenta: '', nombre_banco: '', apodo: '', tipo: 'Transferencia Bs' });
      fetchData();
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Eliminar este método de pago?")) return;
    const token = localStorage.getItem('habioo_token');
    await fetch(`https://auth.habioo.cloud/bancos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  if (userRole !== 'Administrador') return <p>Acceso denegado.</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">💳 Configurar Recepción de Pagos</h3>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* 1. SELECTOR DE TIPO */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Tipo de Método</label>
            <select 
              value={form.tipo} 
              onChange={e => setForm({...form, tipo: e.target.value, numero_cuenta: '', nombre_banco: ''})} 
              className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary"
            >
              {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 2. BANCO (Solo si es Transferencia/Pago Movil) */}
          {isBank && (
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Banco</label>
              <input 
                type="text" 
                placeholder="Ej: Banesco, Mercantil" 
                value={form.nombre_banco} 
                onChange={e => setForm({...form, nombre_banco: e.target.value})} 
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none" 
                required 
              />
            </div>
          )}

          {/* 3. IDENTIFICADOR (Cuenta, Correo o Telefono) - Oculto en Efectivo */}
          {!isCash && (
            <div className={isBank ? "md:col-span-3" : "md:col-span-5"}>
              <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">
                {isDigital ? 'Correo / Teléfono' : 'Número de Cuenta / Datos'}
              </label>
              <input 
                type="text" 
                placeholder={isDigital ? "usuario@email.com" : "0134-..."} 
                value={form.numero_cuenta} 
                onChange={e => setForm({...form, numero_cuenta: e.target.value})} 
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none" 
                required 
              />
            </div>
          )}

          {/* 4. APODO (Siempre visible, ocupa el resto) */}
          <div className={isCash ? "md:col-span-8 flex gap-2" : "md:col-span-3 flex gap-2"}>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Apodo (Etiqueta)</label>
              <input 
                type="text" 
                placeholder="Ej: Principal, Caja Chica..." 
                value={form.apodo} 
                onChange={e => setForm({...form, apodo: e.target.value})} 
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none" 
                required 
              />
            </div>
            <button type="submit" className="bg-donezo-primary text-white font-bold px-5 rounded-xl hover:bg-green-700 shadow-lg h-[50px] mt-auto">
              +
            </button>
          </div>

        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bancos.map(b => (
          <div key={b.id} className="bg-white dark:bg-donezo-card-dark p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center group hover:shadow-md transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  b.tipo.includes('Efectivo') ? 'bg-green-100 text-green-700' : 
                  b.tipo.includes('Zelle') ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {b.tipo}
                </span>
              </div>
              
              {/* Lógica de visualización en la tarjeta */}
              {b.tipo.includes('Efectivo') ? (
                <h4 className="font-bold text-gray-800 dark:text-white text-lg">Recepción en Oficina</h4>
              ) : (
                <h4 className="font-bold text-gray-800 dark:text-white text-lg">{b.nombre_banco}</h4>
              )}

              {!b.tipo.includes('Efectivo') && (
                <p className="text-gray-500 text-sm font-mono my-1 truncate max-w-[200px]" title={b.numero_cuenta}>
                  {b.numero_cuenta}
                </p>
              )}
              
              <span className="text-donezo-primary text-sm font-medium">{b.apodo}</span>
            </div>
            <button onClick={() => handleDelete(b.id)} className="text-gray-300 hover:text-red-500 text-xl transition-colors p-2">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}