import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Cierres() {
  const { userRole } = useOutletContext();
  const [data, setData] = useState({ ciclo_actual: 0, total_usd: '0.00', gastos: [] });
  const [loading, setLoading] = useState(true);
  const [selectedGasto, setSelectedGasto] = useState(null); // Nuevo estado para la Modal

  const fetchPreliminar = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/preliminar', { headers: { 'Authorization': `Bearer ${token}` }});
      const result = await res.json();
      if (result.status === 'success') setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchPreliminar();
  }, [userRole]);

  const handleCerrarCiclo = async () => {
    if (!window.confirm(`¿Seguro de cerrar el Ciclo ${data.ciclo_actual}? Se generarán los avisos de cobro.`)) return;
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/cerrar-ciclo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      alert(result.message);
      if (result.status === 'success') fetchPreliminar();
    } catch (error) {
      alert("Error de conexión");
    }
  };

  if (loading) return <p className="p-6 text-gray-500">Cargando datos contables...</p>;

  return (
    <div className="space-y-6 relative">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center">
        <div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Ciclo Abierto Actual</p>
          <h2 className="text-4xl font-bold text-donezo-primary dark:text-white">#{data.ciclo_actual}</h2>
        </div>
        <div className="text-right">
          <p className="text-gray-500 dark:text-gray-400 font-medium">Total Acumulado a Cobrar</p>
          <h2 className="text-4xl font-bold text-red-500">${data.total_usd}</h2>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Borrador de Gastos (Preliminar)</h3>
          <button onClick={handleCerrarCiclo} disabled={data.gastos.length === 0} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            🔒 Aprobar Preliminar y Cerrar Ciclo
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">💡 Haz doble clic en un registro para inspeccionar la nota.</p>

        {data.gastos.length === 0 ? <p className="text-gray-500 py-4">No hay gastos pendientes en este ciclo.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3">Cuota</th>
                  <th className="p-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.gastos.map((g, i) => (
                  <tr key={i} onDoubleClick={() => setSelectedGasto(g)} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                    <td className="p-3 text-gray-800 dark:text-gray-300 font-medium">{g.proveedor}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{g.concepto}</td>
                    <td className="p-3 text-gray-500 text-sm">{g.numero_cuota} de {g.total_cuotas}</td>
                    <td className="p-3 text-right font-bold text-gray-800 dark:text-gray-300">${g.monto_cuota_usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL VER DETALLES (DOBLE CLIC) */}
      {selectedGasto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative">
            <button onClick={() => setSelectedGasto(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">✕</button>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Inspección de Gasto</h3>
            
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p><strong className="text-gray-800 dark:text-white">Proveedor:</strong> {selectedGasto.proveedor}</p>
              <p><strong className="text-gray-800 dark:text-white">Concepto:</strong> {selectedGasto.concepto}</p>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl my-2 border border-gray-200 dark:border-gray-700">
                <p><strong>Monto Total de Factura:</strong> ${selectedGasto.monto_total_usd}</p>
                <p><strong>Fracción a cobrar hoy:</strong> ${selectedGasto.monto_cuota_usd}</p>
              </div>
              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                <strong className="text-gray-800 dark:text-white block mb-1">Nota Adjunta:</strong>
                <p className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl italic text-gray-700 dark:text-gray-300">
                  {selectedGasto.nota || "El administrador no dejó notas en este gasto."}
                </p>
              </div>
            </div>
            <button onClick={() => setSelectedGasto(null)} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition-all">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}