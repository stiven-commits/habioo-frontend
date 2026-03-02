import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Gastos() {
  const { user, userRole } = useOutletContext();
  const [proveedores, setProveedores] = useState([]);
  const [formGasto, setFormGasto] = useState({
    proveedor_id: '',
    concepto: '',
    monto_bs: '',
    tasa_cambio: '',
    total_cuotas: 1
  });

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
    setFormGasto({ ...formGasto, [e.target.name]: e.target.value });
  };

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    try {
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
      } else {
        alert(data.message || 'Error al registrar gasto');
      }
    } catch (error) {
      alert('Error de conexión al registrar gasto');
    }
  };

  const montoBsNum = parseFloat(formGasto.monto_bs);
  const tasaCambioNum = parseFloat(formGasto.tasa_cambio);
  const totalCuotasNum = parseInt(formGasto.total_cuotas, 10);
  const canCalcUsd = Number.isFinite(montoBsNum) && Number.isFinite(tasaCambioNum) && tasaCambioNum > 0;
  const totalUsdCalc = canCalcUsd ? (montoBsNum / tasaCambioNum).toFixed(2) : null;
  const cuotaUsdCalc = canCalcUsd && Number.isFinite(totalCuotasNum) && totalCuotasNum > 0
    ? (montoBsNum / tasaCambioNum / totalCuotasNum).toFixed(2)
    : null;

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
        <select name="proveedor_id" value={formGasto.proveedor_id} onChange={handleGastoChange} className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required>
          <option value="">Seleccione Proveedor</option>
          {proveedores.map((prov) => (
            <option key={prov.id} value={prov.id}>{prov.nombre}</option>
          ))}
        </select>

        <input type="text" name="concepto" value={formGasto.concepto} onChange={handleGastoChange} placeholder="Concepto" className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="number" step="0.01" min="0" name="monto_bs" value={formGasto.monto_bs} onChange={handleGastoChange} placeholder="Monto (Bs)" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="number" step="0.0001" min="0" name="tasa_cambio" value={formGasto.tasa_cambio} onChange={handleGastoChange} placeholder="Tasa de Cambio (Bs/$)" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
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
