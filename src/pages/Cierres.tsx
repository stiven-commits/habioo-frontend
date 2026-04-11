import { useState, useEffect } from 'react';
import type { FC, ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { useDialog } from '../components/ui/DialogProvider';
import { API_BASE_URL } from '../config/api';
import DataTable from '../components/ui/DataTable';
import HabiooLoader from '../components/ui/HabiooLoader';

interface CierresProps {}

interface OutletContextType {
  userRole?: string;
  condominioTipo?: string;
}

interface Propiedad {
  id: number | string;
  identificador: string;
  prop_cedula?: string;
  alicuota: string;
  vinculada?: boolean;
  es_fantasma?: boolean;
}

interface Gasto {
  mes_asignado: string;
  proveedor: string;
  concepto: string;
  numero_cuota: number | string;
  total_cuotas: number | string;
  monto_cuota_usd: string | number;
  monto_total_usd: string | number;
}

interface PreliminarData {
  mes_actual: string;
  mes_texto: string;
  total_usd: string;
  gastos: Gasto[];
  alicuotas_disponibles: string[];
  metodo_division: 'Alicuota' | 'Partes Iguales';
  jerarquia_objetivo?: string;
  miembros_distribucion?: Array<{
    id: number;
    nombre: string;
    rif: string;
    cuota_participacion: number;
    vinculada: boolean;
    es_fantasma: boolean;
    activo: boolean;
  }>;
}

interface PreliminarResponse extends PreliminarData {
  status: string;
  message?: string;
  error?: string;
}

interface PropiedadesResponse {
  status: string;
  propiedades: Propiedad[];
}

interface ApiActionResponse {
  status: string;
  message?: string;
  error?: string;
  warnings?: string[];
  aviso_general_id?: number | null;
  distribucion?: DistribucionResumen | null;
}

interface DistribucionDetalle {
  miembro_id: number | null;
  nombre_junta: string;
  rif: string;
  monto_usd: number;
  monto_bs: number;
  estado: 'GENERADO' | 'FANTASMA' | 'ERROR';
  nota?: string;
  condominio_individual_id?: number | null;
  gasto_generado_id?: number | null;
}

interface DistribucionResumen {
  metodo_division: 'Alicuota' | 'Partes Iguales';
  total_miembros: number;
  total_usd: number;
  generados: number;
  fantasma: number;
  error: number;
  detalles: DistribucionDetalle[];
}

interface ProjectionMonth {
  total: number;
  items: Gasto[];
}

interface ProyeccionesMap {
  [mes: string]: ProjectionMonth;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  variant: 'warning' | 'success' | 'danger';
}

interface DialogContextType {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const toNumber = (value: string | number | undefined | null): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;

  if (text.includes('.') && text.includes(',')) {
    const n = parseFloat(text.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (text.includes(',') && !text.includes('.')) {
    const n = parseFloat(text.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
};

const normalizarAlicuota = (value: string): string => {
  const raw = String(value ?? '').trim().replace(',', '.');
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return String(value ?? '').trim();
  const normalized = n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return normalized;
};

const formatearAlicuota = (value: string): string => String(value ?? '').trim().replace('.', ',');

const dedupeAlicuotas = (values: string[] = []): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  values.forEach((value) => {
    const key = normalizarAlicuota(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(formatearAlicuota(value));
  });
  return unique;
};

const Cierres: FC<CierresProps> = () => {
  const { userRole, condominioTipo } = useOutletContext<OutletContextType>();
  const isJuntaGeneral = String(condominioTipo || '').trim().toLowerCase() === 'junta general';
  const { showConfirm } = useDialog() as DialogContextType;
  const [data, setData] = useState<PreliminarData>({
    mes_actual: '',
    mes_texto: '',
    total_usd: '0.00',
    gastos: [],
    alicuotas_disponibles: [],
    metodo_division: 'Alicuota',
    jerarquia_objetivo: 'Inmuebles',
  });

  // Estados para el Buscador Inteligente
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [bancos, setBancos] = useState<any[]>([]);
  const [searchProp, setSearchProp] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [selectedPropiedad, setSelectedPropiedad] = useState<Propiedad | null>(null);
  const [tasaBcvHoy, setTasaBcvHoy] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);
  const [simulacionAlicuota, setSimulacionAlicuota] = useState<string>('');
  const [cambiandoMetodo, setCambiandoMetodo] = useState<boolean>(false);
  const [isDivisionExpanded, setIsDivisionExpanded] = useState<boolean>(false);
  // NUEVO ESTADO: Bloquea la pantalla durante el cierre
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [lastDistribucion, setLastDistribucion] = useState<DistribucionResumen | null>(null);
  const [lastWarnings, setLastWarnings] = useState<string[]>([]);

  const fetchPreliminar = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resPreliminar, resProps, resBancos, resBcv] = await Promise.all([
        fetch(`${API_BASE_URL}/preliminar`, { headers: { Authorization: `Bearer ${token}` } }),
        isJuntaGeneral
          ? Promise.resolve(new Response(JSON.stringify({ status: 'success', propiedades: [] }), { headers: { 'Content-Type': 'application/json' } }))
          : fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/bancos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('https://ve.dolarapi.com/v1/dolares/oficial')
      ]);

      const result: PreliminarResponse = await resPreliminar.json();
      const dataProps: PropiedadesResponse = await resProps.json();
      const dataBancos = await resBancos.json();
      const dataBcv = await resBcv.json();

      if (result.status === 'success') {
        const alicuotasUnicas = dedupeAlicuotas(result.alicuotas_disponibles || []);
          setData({
            mes_actual: result.mes_actual,
            mes_texto: result.mes_texto,
            total_usd: result.total_usd,
            gastos: result.gastos,
            alicuotas_disponibles: alicuotasUnicas,
            metodo_division: result.metodo_division,
            jerarquia_objetivo: result.jerarquia_objetivo || 'Inmuebles',
            miembros_distribucion: result.miembros_distribucion || [],
          });
        setSimulacionAlicuota('');
        setSearchProp('');
        setSelectedPropiedad(null);

        if (result.jerarquia_objetivo === 'Juntas Individuales') {
          const juntasSimulacion: Propiedad[] = (result.miembros_distribucion || [])
            .filter((m) => m.activo !== false)
            .map((m) => ({
              id: m.id,
              identificador: m.nombre,
              prop_cedula: m.rif,
              alicuota: String(m.cuota_participacion ?? 0),
              vinculada: Boolean(m.vinculada),
              es_fantasma: Boolean(m.es_fantasma),
            }));
          setPropiedades(juntasSimulacion);
        }
      }

      if (dataProps.status === 'success' && !(result.jerarquia_objetivo === 'Juntas Individuales')) {
        setPropiedades(dataProps.propiedades);
      }
      if (dataBancos.status === 'success') {
        setBancos(dataBancos.bancos || []);
      }
      const promedio = parseFloat(String(dataBcv?.promedio ?? 0));
      if (Number.isFinite(promedio) && promedio > 0) {
        setTasaBcvHoy(parseFloat(promedio.toFixed(3)));
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchPreliminar(); }, [userRole]);

  // LGICA DE TIEMPO
  const today = new Date();
  const realCurrentYM = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const canCloseMonth = data.mes_actual && data.mes_actual < realCurrentYM;
  const isGeneralFlow = data.jerarquia_objetivo === 'Juntas Individuales';
  const hasRequisitosPendientes = isGeneralFlow ? false : (propiedades.length === 0 || bancos.length === 0);
  const juntasFantasma = isGeneralFlow ? propiedades.filter((p) => p.es_fantasma).length : 0;

  const gastosMesActual = data.gastos.filter((g: Gasto) => g.mes_asignado === data.mes_actual);
  const gastosFuturos = data.gastos.filter((g: Gasto) => g.mes_asignado > data.mes_actual);

  const proyecciones = gastosFuturos.reduce<ProyeccionesMap>((acc: ProyeccionesMap, g: Gasto) => {
    const mes = g.mes_asignado;
    const proyeccionMes: ProjectionMonth = acc[mes] ?? { total: 0, items: [] };
    proyeccionMes.items.push(g);
    proyeccionMes.total += toNumber(g.monto_cuota_usd);
    acc[mes] = proyeccionMes;
    return acc;
  }, {});

  const mesesFuturos = Object.keys(proyecciones).sort().slice(0, 4);

  const formatMonthText = (yyyy_mm: string): string => {
    const [year = '', month = '01'] = yyyy_mm.split('-');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthLabel = meses[parseInt(month, 10) - 1] ?? '';
    return `${monthLabel} ${year}`.trim();
  };

  const handleCerrarCiclo = async (): Promise<void> => {
    const ok = await showConfirm({
      title: 'Confirmar cierre de mes',
      message: `Estas a punto de cerrar el mes ${data.mes_texto.toUpperCase()}.\n\nTodos los recibos se generaran usando el metodo: ${data.metodo_division}.`,
      confirmText: 'Cerrar mes',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;
    
    setIsClosing(true); // Activamos el overlay de carga
    const token = localStorage.getItem('habioo_token');
    
    try {
      const res = await fetch(`${API_BASE_URL}/cerrar-ciclo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result: ApiActionResponse = await res.json();
      const warnings = (result.warnings || []).filter((w) => String(w || '').trim().length > 0);
      const modalMessage = warnings.length > 0
        ? `${result.message || 'El mes ha sido cerrado.'}\n\nAdvertencias:\n- ${warnings.join('\n- ')}`
        : (result.message || 'El mes ha sido cerrado.');
      
      await showConfirm({
        title: result.status === 'success' ? (warnings.length > 0 ? 'Cierre completado con advertencias' : 'Exito') : 'Atencion',
        message: modalMessage,
        confirmText: 'Entendido',
        variant: result.status === 'success' && warnings.length === 0 ? 'success' : 'warning',
      });

      if (result.status === 'success') fetchPreliminar();
      if (result.status === 'success' && isGeneralFlow) {
        setLastDistribucion(result.distribucion || null);
        setLastWarnings(warnings);
      }
    } catch (error) {
      await showConfirm({
        title: 'Error de red',
        message: 'Hubo un problema conectando con el servidor.',
        confirmText: 'Entendido',
        variant: 'danger',
      });
    } finally {
      setIsClosing(false); // Apagamos el overlay al terminar
    }
  };
// FUNCION DE PRUEBAS PARA POBLAR LA BASE DE DATOS
  const handleSeeder = async (): Promise<void> => {
    const ok = await showConfirm({
      title: 'Inyectar datos de prueba',
      message: 'Se borraran las pruebas anteriores y se crearan 12 gastos nuevos. Deseas continuar?',
      confirmText: 'Inyectar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;
    
    setLoading(true);
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard-admin/seed-prueba`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result: ApiActionResponse = await res.json();
      await showConfirm({
        title: 'Seeder',
        message: result.message || result.error || '',
        confirmText: 'Entendido',
        variant: 'success',
      });
      fetchPreliminar();
    } catch (error) {
      await showConfirm({ title: 'Error', message: 'Error de conexion con el seeder', confirmText: 'Ok', variant: 'danger' });
      setLoading(false);
    }
  };
  // LOGICA PARA CAMBIAR EL METODO DE DIVISION
  const handleToggleMethod = async (): Promise<void> => {
    if (cambiandoMetodo) return;
    const nuevoMetodo: PreliminarData['metodo_division'] = data.metodo_division === 'Alicuota' ? 'Partes Iguales' : 'Alicuota';
    
    setCambiandoMetodo(true);
    setData((prev: PreliminarData) => ({ ...prev, metodo_division: nuevoMetodo }));

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/metodo-division`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metodo: nuevoMetodo })
      });
      const result: ApiActionResponse = await res.json();
      if (result.status !== 'success') {
        setData((prev: PreliminarData) => ({ ...prev, metodo_division: data.metodo_division }));
        await showConfirm({ title: 'Error', message: 'Error al guardar la preferencia.', confirmText: 'Ok', variant: 'danger' });
      }
    } catch (error) {
      setData((prev: PreliminarData) => ({ ...prev, metodo_division: data.metodo_division }));
      await showConfirm({ title: 'Error de red', message: 'No se pudo cambiar el metodo.', confirmText: 'Ok', variant: 'danger' });
    } finally {
      setCambiandoMetodo(false);
    }
  };

  const calcularProyeccion = (): string => {
    const total = toNumber(data.total_usd);
    if (data.metodo_division === 'Alicuota') {
      const alicuota = toNumber(simulacionAlicuota) || 0;
      return (total * (alicuota / 100)).toFixed(2);
    } else {
      // Si es partes iguales, divide entre el total de elementos activos (inmuebles o juntas individuales)
      const totalProps = propiedades.length || 1;
      return (total / totalProps).toFixed(2);
    }
  };
  const montoSimuladoUsd = toNumber(calcularProyeccion());
  const montoSimuladoBs = montoSimuladoUsd * (tasaBcvHoy || 0);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HabiooLoader size="md" message="" className="py-0" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">

      {!canCloseMonth && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <span className="text-2xl">!</span>
          <div>
            <h4 className="text-red-800 dark:text-red-300 font-bold">Cierre Bloqueado</h4>
            <p className="text-red-700 dark:text-red-400 text-sm mt-1">Aun nos encontramos dentro de <strong>{data.mes_texto}</strong>. No puedes generar los recibos hasta que el mes finalice.</p>
          </div>
        </div>
      )}

      {hasRequisitosPendientes && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <span className="text-2xl">!</span>
          <div>
            <h4 className="text-orange-800 dark:text-orange-300 font-bold">Requisitos Pendientes</h4>
            <p className="text-orange-700 dark:text-orange-400 text-sm mt-1">Para generar los avisos de cobro y cerrar el mes, es obligatorio tener <strong className="font-bold">inmuebles registrados</strong> y al menos una <strong className="font-bold">cuenta bancaria configurada</strong>.</p>
          </div>
        </div>
      )}

      {isGeneralFlow && juntasFantasma > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="text-amber-800 dark:text-amber-300 font-bold">Juntas pendientes de vinculación</h4>
            <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
              Hay <strong>{juntasFantasma}</strong> juntas individuales aún no vinculadas en Habioo. Igual participan en el prorrateo y quedarán en estado pendiente hasta vincularse.
            </p>
          </div>
        </div>
      )}

      {/* PANEL ACORDEON: METODO DE DIVISION */}
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 my-6 overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setIsDivisionExpanded((prev: boolean) => !prev)}
          className="w-full px-6 md:px-8 py-5 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Metodo de Distribucion de Gastos</p>
              <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                Metodo de Division Actual: <span className="text-donezo-primary dark:text-blue-300">{data.metodo_division}</span>
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`w-5 h-5 text-gray-500 dark:text-gray-300 transition-transform duration-300 ${isDivisionExpanded ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </button>

        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isDivisionExpanded ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-6 md:px-8 pb-8 pt-2">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              {isGeneralFlow
                ? 'El metodo de division para Junta General se calcula segun las alicuotas del padron de juntas individuales. Cambialo solo si deseas forzar una distribucion puntual para este cierre.'
                : 'El metodo de division suele configurarse automaticamente segun las alicuotas de sus inmuebles. Cambie esta configuracion haciendo clic en el switch solo si esta seguro de que el prorrateo para este cierre debe ser diferente.'}
            </p>

            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 w-full max-w-4xl mx-auto">
              {/* Lado Alicuota */}
              <div className={`flex-1 text-center md:text-right transition-all duration-500 ${data.metodo_division === 'Alicuota' ? 'opacity-100 scale-105' : 'opacity-40 grayscale scale-95'}`}>
                <h4 className="font-black text-blue-600 dark:text-blue-400 text-2xl mb-2">Por Alicuota</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  {isGeneralFlow
                    ? 'El total de gastos se reparte segun el porcentaje de participacion de cada junta individual.'
                    : 'El total de los gastos se multiplica por el porcentaje (%) exacto de participacion de cada inmueble.'}
                  <br /><span className="text-blue-500 font-bold">{isGeneralFlow ? 'Ideal cuando cada junta individual tiene una alicuota distinta.' : 'Recomendado para edificios con distintos metrajes.'}</span>
                </p>
              </div>

              {/* Switch */}
              <div className="flex items-center justify-center shrink-0">
                <button
                  onClick={handleToggleMethod}
                  disabled={cambiandoMetodo}
                  className={`relative w-28 h-12 flex items-center rounded-full p-1.5 transition-colors duration-500 focus:outline-none shadow-inner disabled:opacity-50 ${
                    data.metodo_division === 'Alicuota' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}
                >
                  <div
                    className={`bg-white w-9 h-9 rounded-full shadow-lg transform transition-transform duration-500 ease-spring flex items-center justify-center ${
                      data.metodo_division === 'Alicuota' ? 'translate-x-0' : 'translate-x-16'
                    }`}
                  >
                    <span className="text-lg">{data.metodo_division === 'Alicuota' ? 'A' : '='}</span>
                  </div>
                </button>
              </div>

              {/* Lado Partes Iguales */}
              <div className={`flex-1 text-center md:text-left transition-all duration-500 ${data.metodo_division === 'Partes Iguales' ? 'opacity-100 scale-105' : 'opacity-40 grayscale scale-95'}`}>
                <h4 className="font-black text-purple-600 dark:text-purple-400 text-2xl mb-2">Partes Iguales</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  {isGeneralFlow
                    ? 'El total de gastos se divide en partes iguales entre todas las juntas individuales activas.'
                    : 'El total de los gastos se divide de manera lineal y exacta entre el numero total de inmuebles activos.'}
                  <br /><span className="text-purple-500 font-bold">Todos pagaran exactamente el mismo monto.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIN RESUMEN MES ACTUAL Y SIMULADOR INTELIGENTE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* TARJETA TOTAL */}
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-center border-l-4 border-l-donezo-primary md:col-span-1">
          <p className="text-gray-500 dark:text-gray-400 font-medium uppercase text-xs tracking-wider">Cobro Oficial del Mes</p>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white capitalize mb-4">{data.mes_texto}</h2>

          <p className="text-gray-500 dark:text-gray-400 font-medium uppercase text-xs tracking-wider">Total a Repartir</p>
          <h2 className="text-4xl font-black text-red-500">${formatMoney(data.total_usd)}</h2>
        </div>

        {/* WIDGET DEL SIMULADOR (COMBOBOX) */}
        <div className={`p-6 rounded-2xl border flex flex-col justify-center md:col-span-2 transition-colors ${data.metodo_division === 'Alicuota' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800'}`}>
          <p className={`font-bold mb-4 text-sm uppercase ${data.metodo_division === 'Alicuota' ? 'text-blue-800 dark:text-blue-300' : 'text-purple-800 dark:text-purple-300'}`}>
            {isGeneralFlow ? `Simulador de Junta (${data.mes_texto})` : `Simulador de Cuota (${data.mes_texto})`}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {data.metodo_division === 'Alicuota' ? (
              <>
                {/* BUSCADOR ALICUOTA */}
                <div className="relative w-full sm:w-1/2">
                  <label className="text-xs text-blue-700 dark:text-blue-300 block mb-1 font-bold">{isGeneralFlow ? 'Buscar Junta Individual' : 'Buscar Inmueble'}</label>
                  <input type="text" value={searchProp} onChange={(e: ChangeEvent<HTMLInputElement>) => { setSearchProp(e.target.value); setSelectedPropiedad(null); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} onBlur={() => setTimeout(() => setShowDropdown(false), 200)} placeholder={isGeneralFlow ? 'Ej: Torre Norte...' : 'Ej: Apto 12...'} className="p-2.5 rounded-xl border border-blue-200 bg-white dark:bg-gray-800 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-400 w-full text-sm dark:text-white" />
                  {showDropdown && searchProp && (
                    <ul className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto mt-2 custom-scrollbar">
                      {propiedades.filter((p: Propiedad) => p.identificador.toLowerCase().includes(searchProp.toLowerCase()) || (p.prop_cedula && p.prop_cedula.toLowerCase().includes(searchProp.toLowerCase()))).map((p: Propiedad) => (
                          <li key={p.id} className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-50 dark:border-gray-700/50 transition-colors" onClick={() => { setSelectedPropiedad(p); setSearchProp(`${p.identificador}`); setSimulacionAlicuota(formatearAlicuota(String(p.alicuota ?? '0'))); setShowDropdown(false); }}>
                            <div className="flex justify-between items-center"><strong className="text-gray-800 dark:text-white text-sm">{p.identificador}</strong><span className="text-xs font-bold text-donezo-primary">{p.alicuota}%</span></div>
                            {isGeneralFlow && p.es_fantasma ? <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">Pendiente de vinculacion</p> : null}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                {/* SELECTOR MANUAL */}
                <div className="w-full sm:w-1/4">
                  <label className="text-xs text-blue-700 dark:text-blue-300 block mb-1 font-bold">Alicuota (%)</label>
                  <select value={simulacionAlicuota} onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const nuevaAlicuota = e.target.value;
                    if (selectedPropiedad) {
                      const alicuotaInmueble = formatearAlicuota(String(selectedPropiedad.alicuota ?? '0'));
                      if (normalizarAlicuota(nuevaAlicuota) !== normalizarAlicuota(alicuotaInmueble)) {
                        setSelectedPropiedad(null);
                        setSearchProp('');
                      }
                    }
                    setSimulacionAlicuota(nuevaAlicuota);
                  }} className="p-2.5 rounded-xl border border-blue-200 bg-white dark:bg-gray-800 dark:border-blue-800 outline-none w-full text-sm font-bold dark:text-white">
                    <option value="">Seleccione...</option>
                    {data.alicuotas_disponibles.map((a: string) => <option key={a} value={a}>{a}%</option>)}
                  </select>
                </div>
                {/* RESULTADO ALICUOTA */}
                <div className="w-full sm:w-1/4 sm:text-right flex flex-col justify-end h-full">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-bold mb-1">Pagaria</p>
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400 leading-none">${formatMoney(montoSimuladoUsd)}</p>
                  <p className="text-xs font-semibold text-blue-700/80 dark:text-blue-300 mt-1">Bs {formatMoney(montoSimuladoBs)} {tasaBcvHoy > 0 ? `(@${formatMoney(tasaBcvHoy, 3)} BCV)` : ''}</p>
                </div>
              </>
            ) : (
              // DISENO PARA PARTES IGUALES
              <div className="flex w-full justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-purple-100 dark:border-purple-800/50">
                 <div>
                   <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider mb-1">{isGeneralFlow ? 'Juntas Individuales Activas' : 'Inmuebles Activos'}</p>
                   <p className="text-2xl font-black text-gray-800 dark:text-white">{propiedades.length} <span className="text-sm font-medium text-gray-500">{isGeneralFlow ? 'juntas' : 'unidades'}</span></p>
                 </div>
                 <div className="text-2xl font-light text-gray-300 dark:text-gray-600">{'->'}</div>
                 <div className="text-right">
                   <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider mb-1">{isGeneralFlow ? 'Cuota por Junta' : 'Cuota por Inmueble'}</p>
                   <p className="text-3xl font-black text-purple-600 dark:text-purple-400 leading-none">${formatMoney(calcularProyeccion())}</p>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL (MES ACTUAL) */}
      {isGeneralFlow && lastDistribucion && (
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">Resultado de Distribucion del Ultimo Cierre</h3>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Metodo: {lastDistribucion.metodo_division}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-xs text-gray-500">Total juntas</p>
              <p className="text-xl font-black text-gray-800 dark:text-gray-100">{lastDistribucion.total_miembros}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-100 dark:border-emerald-800/40">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Generadas</p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{lastDistribucion.generados}</p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-100 dark:border-amber-800/40">
              <p className="text-xs text-amber-700 dark:text-amber-300">Pendientes por vincular</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300">{lastDistribucion.fantasma}</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-100 dark:border-red-800/40">
              <p className="text-xs text-red-700 dark:text-red-300">Con error</p>
              <p className="text-xl font-black text-red-700 dark:text-red-300">{lastDistribucion.error}</p>
            </div>
          </div>

          <DataTable
            tableStyle={{ minWidth: '960px' }}
            columns={[
              { key: 'junta', header: 'Junta Individual', className: 'font-semibold text-gray-800 dark:text-gray-200', render: (d) => d.nombre_junta },
              { key: 'rif', header: 'RIF', className: 'font-mono text-gray-600 dark:text-gray-300', render: (d) => d.rif || '-' },
              { key: 'usd', header: 'Monto USD', headerClassName: 'text-right', className: 'text-right font-bold text-gray-800 dark:text-gray-200', render: (d) => `$${formatMoney(d.monto_usd)}` },
              { key: 'bs', header: 'Monto Bs', headerClassName: 'text-right', className: 'text-right text-gray-700 dark:text-gray-300', render: (d) => `Bs ${formatMoney(d.monto_bs)}` },
              {
                key: 'estado',
                header: 'Estado',
                render: (d) => {
                  if (d.estado === 'GENERADO') return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Generado</span>;
                  if (d.estado === 'FANTASMA') return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Pendiente vinculacion</span>;
                  return <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-300">Error</span>;
                }
              },
              { key: 'nota', header: 'Detalle', className: 'text-xs text-gray-500 dark:text-gray-400', render: (d) => d.nota || '-' },
            ]}
            data={lastDistribucion.detalles || []}
            keyExtractor={(row, index) => `${row.miembro_id || 'm'}-${index}`}
          />
        </div>
      )}

      {isGeneralFlow && lastWarnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm">
          <h4 className="text-amber-800 dark:text-amber-300 font-bold">Advertencias del ultimo cierre</h4>
          <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
            {lastWarnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>- {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Borrador: {data.mes_texto}</h3>
          
          <div className="flex gap-3">
             {/* BOTON DE PRUEBA */}
             <button onClick={handleSeeder} className="bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-bold py-2 px-4 rounded-xl transition-all shadow-sm text-sm border border-purple-200 dark:border-purple-800">
               Inyectar datos
             </button>

             {/* FORZAR CIERRE DE PRUEBA */}
             <button disabled={hasRequisitosPendientes} onClick={handleCerrarCiclo} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
               FORZAR CIERRE (Pruebas)
             </button>

             {/* BOTON REAL DE CIERRE */}
             <button disabled={!canCloseMonth || hasRequisitosPendientes} onClick={handleCerrarCiclo} className="bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
               Generar Recibos
             </button>
          </div>
        </div>

        {gastosMesActual.length === 0 ? <p className="text-gray-500 py-4 text-center border border-dashed border-gray-300 rounded-xl dark:text-gray-400">No hay gastos asignados a este mes.</p> : (
          <DataTable
            columns={[
              { key: 'proveedor', header: 'Proveedor', className: 'text-gray-800 dark:text-gray-300 font-medium', render: (g) => g.proveedor },
              { key: 'concepto', header: 'Concepto', className: 'text-gray-600 dark:text-gray-400', render: (g) => g.concepto },
              { key: 'cuota', header: 'Cuota', headerClassName: 'text-center', className: 'text-center text-xs text-gray-500 dark:text-gray-400', render: (g) => `${g.numero_cuota} de ${g.total_cuotas}` },
              { key: 'monto', header: 'Monto a Cobrar', headerClassName: 'text-right', className: 'text-right font-bold text-gray-800 dark:text-gray-300', render: (g) => `$${formatMoney(g.monto_cuota_usd)}` },
              { key: 'monto_bs', header: 'Monto (Bs)', headerClassName: 'text-right', className: 'text-right font-bold text-gray-800 dark:text-gray-300', render: (g) => `Bs ${formatMoney(toNumber(g.monto_cuota_usd) * (tasaBcvHoy || 0))}` },
            ]}
            data={gastosMesActual}
            keyExtractor={(_, i) => i}
            rowClassName="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer select-none"
            onRowDoubleClick={(g) => setSelectedGasto(g)}
          />
        )}
      </div>

      {mesesFuturos.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">Proyecciones de meses siguientes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {mesesFuturos.map((mes: string) => (
              <div key={mes} className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 opacity-80 hover:opacity-100 transition-opacity">
                <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs mb-3">{formatMonthText(mes)}</h4>

                <div className="space-y-3 mb-4 h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {(proyecciones[mes]?.items ?? []).map((item: Gasto, idx: number) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-xs">
                      <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{item.concepto}</p>
                      <div className="flex justify-between items-center mt-1 text-gray-500 dark:text-gray-400">
                        <span>Cuota {item.numero_cuota}/{item.total_cuotas}</span>
                        <span className="font-bold text-donezo-primary">${formatMoney(item.monto_cuota_usd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedGasto && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setSelectedGasto(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">X</button>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Inspeccion de Gasto</h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p><strong className="text-gray-800 dark:text-white">Proveedor:</strong> {selectedGasto.proveedor}</p>
              <p><strong className="text-gray-800 dark:text-white">Concepto:</strong> {selectedGasto.concepto}</p>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl my-2 border border-gray-200 dark:border-gray-700">
                <p><strong>Monto Total de Factura:</strong> ${formatMoney(selectedGasto.monto_total_usd)}</p>
                <p><strong>Fraccion a cobrar este mes:</strong> ${formatMoney(selectedGasto.monto_cuota_usd)}</p>
              </div>
            </div>
            <button onClick={() => setSelectedGasto(null)} className="mt-6 w-full px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all dark:text-gray-300">Cerrar</button>
          </div>
        </div>
      )}
      {/* OVERLAY DE CARGA: PROCESANDO CIERRE DE MES */}
      {isClosing && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* SPINNER ANIMADO */}
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-donezo-primary border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl">...</div>
            </div>
            
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">Procesando Cierre...</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              El sistema esta generando los recibos individuales, distribuyendo los gastos y preparando el nuevo mes.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 w-full">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider animate-pulse">
                Por favor no recargues la pagina
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Cierres;

