import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';

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

  // Estados para el Buscador Inteligente
  const [propiedades, setPropiedades] = useState([]);
  const [searchProp, setSearchProp] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [loading, setLoading] = useState(true);
  const [selectedGasto, setSelectedGasto] = useState(null);
  const [simulacionAlicuota, setSimulacionAlicuota] = useState('');

  const fetchPreliminar = async () => {
    const token = localStorage.getItem('habioo_token');
    try {
      // Pedimos al servidor el preliminar Y la lista de inmuebles al mismo tiempo
      const [resPreliminar, resProps] = await Promise.all([
        fetch('https://auth.habioo.cloud/preliminar', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('https://auth.habioo.cloud/propiedades-admin', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const result = await resPreliminar.json();
      const dataProps = await resProps.json();

      if (result.status === 'success') {
        setData(result);
        if (result.alicuotas_disponibles.length > 0) setSimulacionAlicuota(result.alicuotas_disponibles[0]);
      }

      if (dataProps.status === 'success') {
        setPropiedades(dataProps.propiedades);
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchPreliminar(); }, [userRole]);

  // LÓGICA DE TIEMPO
  const today = new Date();
  const realCurrentYM = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const canCloseMonth = data.mes_actual && data.mes_actual < realCurrentYM;

  // DIVISIÓN DE GASTOS (HOY vs FUTURO)
  const gastosMesActual = data.gastos.filter(g => g.mes_asignado === data.mes_actual);
  const gastosFuturos = data.gastos.filter(g => g.mes_asignado > data.mes_actual);

  const proyecciones = gastosFuturos.reduce((acc, g) => {
    if (!acc[g.mes_asignado]) acc[g.mes_asignado] = { total: 0, items: [] };
    acc[g.mes_asignado].items.push(g);
    acc[g.mes_asignado].total += parseFloat(g.monto_cuota_usd);
    return acc;
  }, {});

  const mesesFuturos = Object.keys(proyecciones).sort().slice(0, 4);

  const formatMonthText = (yyyy_mm) => {
    const [year, month] = yyyy_mm.split('-');
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${meses[parseInt(month) - 1]} ${year}`;
  };

  const handleCerrarCiclo = async () => {
    if (!window.confirm(`⚠️ ESTÁS A PUNTO DE CERRAR EL MES DE ${data.mes_texto.toUpperCase()}.\n\nTodos los recibos se generarán. ¿Estás seguro?`)) return;
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
    } else return "N/A";
  };

  if (loading) return <p className="p-6 text-gray-500 dark:text-gray-400">Cargando datos contables...</p>;

  return (
    <div className="space-y-6 relative">

      {!canCloseMonth && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <h4 className="text-red-800 dark:text-red-300 font-bold">Cierre Bloqueado</h4>
            <p className="text-red-700 dark:text-red-400 text-sm mt-1">Aún nos encontramos dentro de <strong>{data.mes_texto}</strong>. No puedes generar los recibos hasta que el mes finalice.</p>
          </div>
        </div>
      )}

      {/* SECCIÓN RESUMEN MES ACTUAL Y SIMULADOR INTELIGENTE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* TARJETA TOTAL */}
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-center border-l-4 border-l-donezo-primary md:col-span-1">
          <p className="text-gray-500 dark:text-gray-400 font-medium uppercase text-xs tracking-wider">Cobro Oficial del Mes</p>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white capitalize mb-4">{data.mes_texto}</h2>

          <p className="text-gray-500 dark:text-gray-400 font-medium uppercase text-xs tracking-wider">Total a Repartir</p>
          <h2 className="text-4xl font-black text-red-500">${formatMoney(data.total_usd)}</h2>
        </div>

        {/* WIDGET DEL SIMULADOR (COMBOBOX) */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col justify-center md:col-span-2">
          <p className="text-blue-800 dark:text-blue-300 font-bold mb-4 text-sm uppercase">🔍 Simulador de Cuota ({data.mes_texto})</p>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {data.metodo_division === 'Alicuota' ? (
              <>
                {/* 1. BUSCADOR (COMBOBOX) */}
                <div className="relative w-full sm:w-1/2">
                  <label className="text-xs text-blue-700 dark:text-blue-300 block mb-1 font-bold">Buscar por Apto / Cédula</label>
                  <input
                    type="text"
                    value={searchProp}
                    onChange={(e) => {
                      setSearchProp(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    // El timeout permite que el clic en la lista se registre antes de cerrarse
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Ej: Apto 12, V123..."
                    className="p-2.5 rounded-xl border border-blue-200 bg-white dark:bg-gray-800 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-400 w-full text-sm dark:text-white"
                  />

                  {/* LISTA DESPLEGABLE DEL COMBOBOX */}
                  {showDropdown && searchProp && (
                    <ul className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto mt-2 custom-scrollbar">
                      {propiedades
                        .filter(p => p.identificador.toLowerCase().includes(searchProp.toLowerCase()) || (p.prop_cedula && p.prop_cedula.toLowerCase().includes(searchProp.toLowerCase())))
                        .map(p => (
                          <li
                            key={p.id}
                            className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors"
                            onClick={() => {
                              setSearchProp(`${p.identificador} (${p.prop_nombre || 'Sin Propietario'})`);
                              setSimulacionAlicuota(p.alicuota);
                              setShowDropdown(false);
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <strong className="text-gray-800 dark:text-white text-sm">{p.identificador}</strong>
                              <span className="text-xs font-bold text-donezo-primary">{p.alicuota}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{p.prop_cedula || 'Sin ID'} - {p.prop_nombre || 'Desconocido'}</p>
                          </li>
                        ))}
                      {propiedades.filter(p => p.identificador.toLowerCase().includes(searchProp.toLowerCase()) || (p.prop_cedula && p.prop_cedula.toLowerCase().includes(searchProp.toLowerCase()))).length === 0 && (
                        <li className="p-3 text-sm text-gray-500 text-center dark:text-gray-400">No se encontraron resultados.</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* 2. SELECTOR MANUAL DE ALÍCUOTA */}
                <div className="w-full sm:w-1/4">
                  <label className="text-xs text-blue-700 dark:text-blue-300 block mb-1 font-bold">Alícuota Manual</label>
                  <select
                    value={simulacionAlicuota}
                    onChange={(e) => {
                      setSimulacionAlicuota(e.target.value);
                      setSearchProp(''); // Si usa el manual, limpiamos el buscador
                    }}
                    className="p-2.5 rounded-xl border border-blue-200 bg-white dark:bg-gray-800 dark:border-blue-800 outline-none w-full text-sm font-bold dark:text-white"
                  >
                    {data.alicuotas_disponibles.map((a, i) => <option key={i} value={a}>{a}%</option>)}
                  </select>
                </div>

                {/* 3. RESULTADO DE LA PROYECCIÓN */}
                <div className="w-full sm:w-1/4 sm:text-right flex flex-col justify-end h-full">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-bold mb-1">Estimado a Pagar</p>
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400 leading-none">
                    {calcularProyeccion() === 'N/A' ? 'N/A' : `$${formatMoney(calcularProyeccion())}`}
                  </p>
                </div>
              </>
            ) : <p className="text-gray-600 dark:text-gray-300 italic">División en partes iguales.</p>}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL (MES ACTUAL) */}
      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Borrador: {data.mes_texto}</h3>
          {/* BOTÓN ORIGINAL (Comentado para pruebas) 
          <button onClick={handleCerrarCiclo} disabled={!canCloseMonth || gastosMesActual.length === 0} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
            🔒 Aprobar y Cerrar {data.mes_texto}
          </button>
          */}

          {/* BOTÓN DE PRUEBA (Siempre habilitado) */}
          <button onClick={handleCerrarCiclo} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg">
            🚨 FORZAR CIERRE {data.mes_texto}
          </button>
        </div>

        {gastosMesActual.length === 0 ? <p className="text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded-xl dark:text-gray-400">No hay gastos asignados a este mes.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-none">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 text-sm dark:text-gray-400">
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Concepto</th>
                  <th className="p-3 text-center">Cuota</th>
                  <th className="p-3 text-right">Monto a Cobrar</th>
                </tr>
              </thead>
              <tbody>
                {gastosMesActual.map((g, i) => (
                  <tr key={i} onDoubleClick={() => setSelectedGasto(g)} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                    <td className="p-3 text-gray-800 dark:text-gray-300 font-medium text-sm">{g.proveedor}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400 text-sm">{g.concepto}</td>
                    <td className="p-3 text-center text-gray-500 text-xs dark:text-gray-400">{g.numero_cuota} de {g.total_cuotas}</td>
                    <td className="p-3 text-right font-bold text-gray-800 dark:text-gray-300">${formatMoney(g.monto_cuota_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MÓDULO DE PROYECCIONES FUTURAS (AHORA CON ALÍCUOTA DINÁMICA) */}
      {mesesFuturos.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            🚀 Proyecciones de Meses Siguientes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {mesesFuturos.map(mes => (
              <div key={mes} className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 opacity-80 hover:opacity-100 transition-opacity">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs mb-3">{formatMonthText(mes)}</h4>

                <div className="space-y-3 mb-4 h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {proyecciones[mes].items.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-xs">
                      <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{item.concepto}</p>
                      <div className="flex justify-between items-center mt-1 text-gray-500 dark:text-gray-400">
                        <span>Cuota {item.numero_cuota}/{item.total_cuotas}</span>
                        <span className="font-bold text-donezo-primary">${formatMoney(item.monto_cuota_usd)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* SUBTOTAL Y ESTIMACIÓN DEL FUTURO */}
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-bold uppercase dark:text-gray-400">Total del Mes:</span>
                    <span className="font-black text-gray-800 dark:text-white text-sm">${formatMoney(proyecciones[mes].total)}</span>
                  </div>

                  {/* AQUÍ SE REFLEJA Y PERMITE EDITAR LA ALÍCUOTA SELECCIONADA */}
                  {data.metodo_division === 'Alicuota' && simulacionAlicuota && (
                    <div className="flex flex-col gap-1.5 bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Alícuota:</span>
                        <select
                          value={simulacionAlicuota}
                          onChange={(e) => {
                            setSimulacionAlicuota(e.target.value);
                            setSearchProp('');
                          }}
                          className="px-1 py-0.5 rounded border border-blue-200 bg-white dark:bg-gray-800 dark:border-blue-700 outline-none text-xs font-bold text-blue-700 dark:text-blue-300"
                        >
                          {data.alicuotas_disponibles.map((a, i) => <option key={i} value={a}>{a}%</option>)}
                        </select>
                      </div>
                      <div className="flex justify-between items-center mt-0.5 border-t border-blue-200/50 dark:border-blue-800/50 pt-1">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Tu Estimado:</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                          ${formatMoney(proyecciones[mes].total * (parseFloat(simulacionAlicuota) / 100))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

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
                <p><strong>Monto Total de Factura:</strong> ${formatMoney(selectedGasto.monto_total_usd)}</p>
                <p><strong>Fracción a cobrar este mes:</strong> ${formatMoney(selectedGasto.monto_cuota_usd)}</p>
              </div>
            </div>
            <button onClick={() => setSelectedGasto(null)} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all dark:text-gray-300">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
