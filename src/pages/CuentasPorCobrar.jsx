import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function CuentasPorCobrar() {
  const { userRole } = useOutletContext();
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole === 'Administrador') {
      const token = localStorage.getItem('habioo_token');
      fetch('https://auth.habioo.cloud/cuentas-por-cobrar', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') setRecibos(data.recibos);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [userRole]);

  // Colores dinámicos para las etiquetas de estado
  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'Aviso de Cobro':
        return <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 py-1 px-3 rounded-full text-xs font-bold">Pendiente de Pago</span>;
      case 'Pagado':
        return <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 py-1 px-3 rounded-full text-xs font-bold">Por Validar</span>;
      case 'Validado':
        return <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 py-1 px-3 rounded-full text-xs font-bold">Pagado y Validado</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 py-1 px-3 rounded-full text-xs font-bold">{estado}</span>;
    }
  };

  if (loading) return <p className="text-gray-500">Cargando cuentas por cobrar...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">💰 Cuentas por Cobrar (Avisos Emitidos)</h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl font-medium">
            Total Emitidos: {recibos.length}
          </div>
        </div>

        {recibos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aún no has generado deudas para tus inmuebles.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                  <th className="p-3">Recibo #</th>
                  <th className="p-3">Inmueble</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3">Fecha Emisión</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Deuda (USD)</th>
                </tr>
              </thead>
              <tbody>
                {recibos.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-3 text-gray-400 text-sm">#{r.id.toString().padStart(4, '0')}</td>
                    <td className="p-3 font-bold text-gray-800 dark:text-white">{r.inmueble}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400 capitalize">{r.ciclo}</td>
                    <td className="p-3 text-gray-500 text-sm">{r.fecha}</td>
                    <td className="p-3">{getStatusBadge(r.estado)}</td>
                    <td className="p-3 text-right font-bold text-red-500">${r.monto_usd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}