import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Cierres() {
  const { userRole } = useOutletContext();
  const [data, setData] = useState({ 
    mes_actual: '', 
    mes_texto: '',
    total_usd: '0.00', 
    gastos: [], 
    alicuotas_disponibles: [], 
    metodo_division: 'Alicuota' 
  });
  const [loading, setLoading] = useState(true);
  const [selectedGasto, setSelectedGasto] = useState(null);
  const [simulacionAlicuota, setSimulacionAlicuota] = useState('');

  const fetchPreliminar = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/preliminar', { headers: { 'Authorization': `Bearer ${token}` }});
      const result = await res.json();
      if (result.status === 'success') {
        setData(result);
        if(result.alicuotas_disponibles.length > 0) setSimulacionAlicuota(result.alicuotas_disponibles[0]);
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchPreliminar(); }, [userRole]);

  const handleCerrarCiclo = async () => {
    if (!window.confirm(`⚠️ ESTÁS A PUNTO DE CERRAR EL MES DE ${data.mes_texto.toUpperCase()}.\n\n¿Estás seguro? Todos los recibos se generarán y no podrás deshacer esta acción.`)) return;
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/cerrar-ciclo', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const result = await res.json();
      alert(result.message);
      if (result.status === 'success') fetchPreliminar();
    } catch (error) { alert("Error de conexión"); }
  };

  const calcularProyeccion = () => {
    const total = parseFloat(data.total_usd);
    if (data.metodo_division === 'Alicuota') {
      const alicuota = parseFloat(simulacionAlicuota) || 0;
      return (total * (alicuota / 100)).toFixed(2);
    } else {
      return "N/A (División exacta)"; 
    }
  };

  if (loading) return <p className="p-6 text-gray-500">Cargando datos contables...</p>;

  // Obtener fecha actual para la alerta inteligente
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const mostrarAlerta = diaActual < 25; // Si no es final de mes, avisamos

  return (
    <div className="space-y-6 relative">
      
      {/* ALERTA INTELIGENTE */}
      {mostrarAlerta && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="text-yellow-800 dark:text-yellow-300 font-bold">Recordatorio Contable</h4>
            <p className="text-yellow-700 dark:text-yellow-400 text-sm mt-1">
              Es recomendable generar los recibos de cobro durante los <strong>últimos 5 días del mes o el día 1 del siguiente</strong>. Si apruebas este preliminar hoy, cualquier gasto ingresado mañana pasará automáticamente al recibo del próximo mes.
            </p>
          </div>
        </div>
      )}

      {/* SECCIÓN DE RESUMEN Y SIMULACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div>
            <p className="text-gray-500 dark:text-gray-400 font-medium uppercase text-xs tracking-wider">Mes de Cobro Abierto</p>
            <h2 className="text-3xl md:text-4xl font-bold text-donezo-primary dark:text-white capitalize">{data.mes_texto}</h2>
          </div>
          <div className="text-right">
            <p className="text-gray-500 dark:text-gray-400 font-medium uppercase text-xs tracking-wider">Total Comunes</p>
            <h2 className="text-3xl md:text-4xl font-bold text-red-500">${data.total_usd}</h2>
          </div>
        </div>

        {/* TARJETA DERECHA: SIMULADOR DE COBRO */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
          <p className="text-blue-800 dark:text-blue-300 font-bold mb-2 text-sm uppercase">🔍 Proyección de Cobro</p>
          
          <div className="flex items-center gap-4">
            {data.metodo_division === 'Alicuota' ? (
              <>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Selecciona Alícuota</label>
                  <select 
                    value={simulacionAlicuota} 
                    onChange={(e) => setSimulacionAlicuota(e.target.value)}
                    className="p-2 rounded-lg border border-blue-200 bg-white dark:bg-gray-800 dark:border-gray-600 outline-none text-lg font-bold w-32"
                  >
                    {data.alicuotas_disponibles.map((a, i) => (
                      <option key={i} value={a}>{a}%</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-gray-500">Monto estimado a pagar</p>
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    ${calcularProyeccion()}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-300 italic">
                El cobro se dividirá en partes iguales entre todos los inmuebles activos.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Borrador de Gastos Comunes</h3>
          <button onClick={handleCerrarCiclo} disabled={data.gastos.length === 0} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            🔒 Aprobar y Cerrar Ciclo
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">💡 Este listado solo muestra los gastos que afectan la alícuota general.</p>

        {data.gastos.length === 0 ? <p className="text-gray-500 py-4 text-center">No hay gastos comunes pendientes en este ciclo.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-center">Cuota</th>
                  <th className="p-3 text-right">Por Pagar (Saldo)</th>
                  <th className="p-3 text-right">Monto a Cobrar</th>
                </tr>
              </thead>
              <tbody>
                {data.gastos.map((g, i) => (
                  <tr key={i} onDoubleClick={() => setSelectedGasto(g)} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                    <td className="p-3 text-gray-800 dark:text-gray-300 font-medium">{g.proveedor}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{g.concepto}</td>
                    <td className="p-3 text-center text-gray-500 text-sm">{g.numero_cuota} de {g.total_cuotas}</td>
                    <td className="p-3 text-right text-orange-400 font-mono text-sm">${parseFloat(g.saldo_restante).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-gray-800 dark:text-gray-300">${g.monto_cuota_usd}</td>
                  </tr>
                ))}
                {/* FOOTER TOTALIZADOR */}
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td colSpan="4" className="p-3 text-right font-bold text-gray-600 dark:text-gray-400 uppercase">Total a Distribuir:</td>
                  <td className="p-3 text-right font-black text-xl text-donezo-primary dark:text-white">${data.total_usd}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALLES */}
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
                <p className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-orange-500 font-bold">
                  Quedará pendiente: ${parseFloat(selectedGasto.saldo_restante).toFixed(2)}
                </p>
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