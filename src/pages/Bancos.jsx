import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalFondos from '../components/ModalFondos';

export default function Bancos() {
  const { userRole } = useOutletContext();
  const [bancos, setBancos] = useState([]);
  const [selectedBancoForFondos, setSelectedBancoForFondos] = useState(null);
  const [form, setForm] = useState({ 
    numero_cuenta: '', nombre_banco: '', apodo: '', tipo: 'Transferencia Bs' 
  });

  const TIPOS_PAGO = [
    "Transferencia Bs", "Pago MÃ³vil", "Zelle", "Efectivo USD", "Efectivo EUR", "Banesco PanamÃ¡", "Paypal"
  ];

  const BANCOS_VENEZUELA = [
    "Banco de Venezuela (BDV)", "Banesco Banco Universal", "Banco Mercantil", "BBVA Provincial",
    "Banco Nacional de CrÃ©dito (BNC)", "Bancamiga Banco Universal", "Banplus Banco Universal",
    "Banco del Tesoro", "Banco del Caribe (Bancaribe)", "Banco Fondo ComÃºn (BFC)", "Banco CaronÃ­",
    "Banco Activo", "Banco Venezolano de CrÃ©dito (BVC)", "Banco Sofitasa", "100% Banco",
    "Delsur Banco Universal", "Banco AgrÃ­cola de Venezuela", "Banco Bicentenario", "Banco Plaza",
    "Banco Exterior", "Banco de la Fuerza Armada Nacional Bolivariana (Banfanb)",
    "Banco Digital de los Trabajadores (BDT)", "N58 Banco Digital", "Bancrecer", "Bangente", "R4 Banco Microfinanciero"
  ];

  const fetchData = async () => {
    const token = localStorage.getItem('habioo_token');
    const res = await fetch('https://auth.habioo.cloud/bancos', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.status === 'success') setBancos(data.bancos);
  };

  useEffect(() => { if (userRole === 'Administrador') fetchData(); }, [userRole]);

  // LÃ³gica DinÃ¡mica Inteligente
  const isCash = form.tipo.includes('Efectivo');
  const isDigital = ['Zelle', 'Paypal'].includes(form.tipo);
  const isPanama = form.tipo === 'Banesco PanamÃ¡';
  const isVenBank = ['Transferencia Bs', 'Pago MÃ³vil'].includes(form.tipo);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('habioo_token');

    let payload = { ...form };

    // Rellenar datos automÃ¡ticos para no romper la BD
    if (isCash) {
      payload.nombre_banco = 'Caja Fuerte / Oficina';
      payload.numero_cuenta = 'N/A';
    } else if (isDigital || isPanama) {
      payload.nombre_banco = form.tipo;
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

  const handleSetPredeterminada = async (id) => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`https://auth.habioo.cloud/bancos/${id}/predeterminada`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        return;
      }
      if (res.status === 404) {
        alert('La ruta para marcar cuenta principal no estÃ¡ disponible en el backend desplegado.');
        return;
      }
      alert('No se pudo actualizar la cuenta principal.');
    } catch (error) {
      console.error('Error al actualizar la cuenta predeterminada:', error);
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Â¿Eliminar este mÃ©todo de pago?")) return;
    const token = localStorage.getItem('habioo_token');
    await fetch(`https://auth.habioo.cloud/bancos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  if (userRole !== 'Administrador') return <p className="p-6">Acceso denegado.</p>;

  // FunciÃ³n para renderizar el Ã­cono de flecha en los Select
  const SelectIcon = () => (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6">ðŸ’³ Configurar RecepciÃ³n de Pagos</h3>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          
          {/* 1. SELECTOR DE TIPO (Con nuevo diseÃ±o) */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1 dark:text-gray-400">Tipo de MÃ©todo</label>
            <div className="relative">
              <select 
                value={form.tipo} 
                onChange={e => setForm({...form, tipo: e.target.value, numero_cuenta: '', nombre_banco: ''})} 
                className="w-full p-3 pr-10 appearance-none rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white dark:border-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary transition-colors cursor-pointer font-medium"
              >
                {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <SelectIcon />
            </div>
          </div>

          {/* 2. BANCO (Selector Venezolano con nuevo diseÃ±o) */}
          {isVenBank && (
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1 dark:text-gray-400">Banco Destino</label>
              <div className="relative">
                <select 
                  value={form.nombre_banco} 
                  onChange={e => setForm({...form, nombre_banco: e.target.value})} 
                  className="w-full p-3 pr-10 appearance-none rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary transition-colors cursor-pointer" 
                  required 
                >
                  <option value="">Seleccione un banco...</option>
                  {BANCOS_VENEZUELA.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <SelectIcon />
              </div>
            </div>
          )}

          {/* 3. DATOS DE CUENTA / CORREO / TELÃ‰FONO */}
          {!isCash && (
            <div className={isVenBank ? "md:col-span-3" : "md:col-span-5"}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1 dark:text-gray-400">
                {isDigital ? 'Correo / TelÃ©fono' : form.tipo === 'Pago MÃ³vil' ? 'Datos (TelÃ©fono, CÃ©dula)' : 'NÃºmero de Cuenta'}
              </label>
              <input 
                type="text" 
                placeholder={isDigital ? "usuario@email.com" : form.tipo === 'Pago MÃ³vil' ? "0414... / V12..." : "0134-..."} 
                value={form.numero_cuenta} 
                onChange={e => setForm({...form, numero_cuenta: e.target.value})} 
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary transition-all" 
                required 
              />
            </div>
          )}

          {/* 4. ETIQUETA (Ocupa el espacio restante) */}
          <div className={isCash ? "md:col-span-9 flex gap-3" : "md:col-span-3 flex gap-3"}>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1 dark:text-gray-400">Etiqueta</label>
              <input 
                type="text" 
                placeholder="Ej: Principal, Caja Chica..." 
                value={form.apodo} 
                onChange={e => setForm({...form, apodo: e.target.value})} 
                className="w-full p-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 outline-none focus:ring-2 focus:ring-donezo-primary transition-all" 
                required 
              />
            </div>
            <button type="submit" className="bg-donezo-primary text-white font-bold px-6 rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/30 h-[50px] mt-auto transition-transform active:scale-95 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
            </button>
          </div>

        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bancos.map(b => (
          <div key={b.id} className="bg-white dark:bg-donezo-card-dark p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center group hover:shadow-md transition-all">
            <div className="w-full pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  b.tipo.includes('Efectivo') ? 'bg-green-100 text-green-700' : 
                  b.tipo.includes('Zelle') ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {b.tipo}
                </span>
              </div>
              
              {b.tipo.includes('Efectivo') ? (
                <h4 className="font-bold text-gray-800 dark:text-white text-lg">RecepciÃ³n en Oficina</h4>
              ) : (
                <h4 className="font-bold text-gray-800 dark:text-white text-lg truncate" title={b.nombre_banco}>{b.nombre_banco}</h4>
              )}

              {!b.tipo.includes('Efectivo') && (
                <p className="text-gray-500 text-sm font-mono my-1 truncate w-full dark:text-gray-400" title={b.numero_cuenta}>
                  {b.numero_cuenta}
                </p>
              )}
              
              <span className="text-donezo-primary text-sm font-medium">{b.apodo}</span>
            </div>
            {/* BUTTON GROUP: FONDOS + PRINCIPAL + ELIMINAR */}
            <div className="flex w-full shadow-sm rounded-xl overflow-hidden mt-3">
              <button
                onClick={() => setSelectedBancoForFondos(b)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-gray-200 dark:border-gray-700 border-r-0"
                title="Gestionar sub-cuentas de fondos"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Fondos
              </button>

              {b.es_predeterminada ? (
                <div className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold px-3 py-2 border border-green-200 dark:border-green-800 border-r-0 cursor-default">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Principal
                </div>
              ) : (
                <button
                  onClick={() => handleSetPredeterminada(b.id)}
                  className="flex-1 text-xs text-blue-600 hover:text-blue-700 font-bold bg-white hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-blue-900/20 px-3 py-2 transition-colors border border-gray-200 dark:border-gray-700 border-r-0"
                  title="Los avisos de cobro pedirán transferir a esta cuenta"
                >
                  Hacer Principal
                </button>
              )}

              <button
                onClick={() => handleDelete(b.id)}
                className="flex items-center justify-center px-3 py-2 bg-white hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-lg transition-colors border border-gray-200 dark:border-gray-700"
                title="Eliminar cuenta"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* MODAL DE FONDOS */}
      {selectedBancoForFondos && (
        <ModalFondos 
          cuenta={selectedBancoForFondos} 
          onClose={() => setSelectedBancoForFondos(null)} 
        />
      )}
    </div>
  );
}
