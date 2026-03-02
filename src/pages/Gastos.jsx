import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Gastos() {
  const { user, userRole } = useOutletContext();
  const [proveedores, setProveedores] = useState([]);
  const [searchProv, setSearchProv] = useState('');
  const [showProvList, setShowProvList] = useState(false);
  const [formGasto, setFormGasto] = useState({
    proveedor_id: '',
    concepto: '',
    monto_bs: '',
    tasa_cambio: '',
    total_cuotas: 1
  });

  const formatCurrency = (val) => {
    if (!val) return '';
    // 1. Eliminamos todo excepto números y LA COMA
    let cleanVal = val.toString().replace(/[^0-9,]/g, '');
    
    // 2. Prevenimos que el usuario escriba dos comas por error (ej: 100,50,2)
    let parts = cleanVal.split(',');
    if (parts.length > 2) {
      parts = [parts[0], parts.slice(1).join('')];
    }
    
    // 3. Agregamos los puntos de miles SOLO a la parte entera
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    return parts.join(',');
  };

  const parseCurrencyToFloat = (val) => {
    if (!val) return 0;
    // Traduce el formato Latino (1.000,50) a formato Computadora (1000.50)
    const parsed = parseFloat(val.toString().replace(/\./g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    if (userRole !== 'Administrador') return;

    const token = localStorage.getItem('habioo_token');
    if (!token) return;

    const fetchProveedores = async () => {
      try {
        const res = await fetch('https://auth.habioo.cloud/proveedores', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          setProveedores(data.proveedores);
        }
      } catch (error) {
        console.error('Error cargando proveedores:', error);
      }
    };

    fetchProveedores();
  }, [userRole]);

  const handleGastoChange = (e) => {
    const { name, value } = e.target;
    if (name === 'monto_bs' || name === 'tasa_cambio') {
      setFormGasto({ ...formGasto, [name]: formatCurrency(value) });
      return;
    }
    setFormGasto({ ...formGasto, [name]: value });
  };

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    try {
      if (!formGasto.proveedor_id) {
        alert('Selecciona un proveedor de la lista');
        return;
      }

      const token = localStorage.getItem('habioo_token');
      const response = await fetch('https://auth.habioo.cloud/gastos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formGasto)
      });

      const data = await response.json();
      if (data.status === 'success') {
        alert(data.message || 'Gasto registrado con éxito');
        setFormGasto({ proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: 1 });
        setSearchProv('');
        setShowProvList(false);
      } else {
        alert(data.message || 'Error al registrar gasto');
      }
    } catch (error) {
      alert('Error de conexión al registrar gasto');
    }
  };

  const montoBsNum = parseCurrencyToFloat(formGasto.monto_bs);
  const tasaCambioNum = parseCurrencyToFloat(formGasto.tasa_cambio);
  const totalCuotasNum = parseInt(formGasto.total_cuotas, 10);
  const canCalcUsd = Number.isFinite(montoBsNum) && Number.isFinite(tasaCambioNum) && tasaCambioNum > 0;
  const totalUsdCalc = canCalcUsd ? (montoBsNum / tasaCambioNum).toFixed(2) : null;
  const cuotaUsdCalc = canCalcUsd && Number.isFinite(totalCuotasNum) && totalCuotasNum > 0
    ? (montoBsNum / tasaCambioNum / totalCuotasNum).toFixed(2)
    : null;
  const filteredProveedores = proveedores.filter((prov) => {
    const q = searchProv.toLowerCase();
    return prov.nombre?.toLowerCase().includes(q) || prov.identificador?.toLowerCase().includes(q);
  });

  if (userRole !== 'Administrador') {
    return (
      <section className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
        <p className="text-gray-600 dark:text-gray-300">{user?.nombre}, no tienes permisos para registrar gastos.</p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-donezo-card-dark rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Registrar Gasto</h3>
      <form onSubmit={handleRegistrarGasto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            value={searchProv}
            onChange={(e) => {
              setSearchProv(e.target.value);
              setShowProvList(true);
              setFormGasto({ ...formGasto, proveedor_id: '' });
            }}
            onFocus={() => setShowProvList(true)}
            placeholder="Buscar proveedor por nombre o identificador"
            className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
            required
          />
          {searchProv.trim() && showProvList && (
            <ul className="absolute mt-1 w-full max-h-56 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10">
              {filteredProveedores.length > 0 ? (
                filteredProveedores.map((prov) => (
                  <li
                    key={prov.id}
                    onClick={() => {
                      setFormGasto({ ...formGasto, proveedor_id: prov.id });
                      setSearchProv(prov.nombre);
                      setShowProvList(false);
                    }}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                  >
                    {prov.nombre} ({prov.identificador})
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400">Sin coincidencias</li>
              )}
            </ul>
          )}
        </div>

        <input type="text" name="concepto" value={formGasto.concepto} onChange={handleGastoChange} placeholder="Concepto" className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="text" inputMode="decimal" name="monto_bs" value={formGasto.monto_bs} onChange={handleGastoChange} placeholder="Monto (Bs)" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="text" inputMode="decimal" name="tasa_cambio" value={formGasto.tasa_cambio} onChange={handleGastoChange} placeholder="Tasa de Cambio (Bs/$)" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="number" min="1" name="total_cuotas" value={formGasto.total_cuotas} onChange={handleGastoChange} placeholder="Total Cuotas" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />

        <div className="md:col-span-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Total en USD: <span className="font-bold">{totalUsdCalc ? `$${totalUsdCalc}` : '--'}</span>
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
            Monto por Cuota en USD: <span className="font-bold">{cuotaUsdCalc ? `$${cuotaUsdCalc}` : '--'}</span>
          </p>
        </div>

        <button type="submit" className="md:col-span-2 w-full p-3 rounded-xl font-semibold bg-orange-500 text-white hover:opacity-90 transition-all">
          Guardar Gasto
        </button>
      </form>
    </section>
  );
}
