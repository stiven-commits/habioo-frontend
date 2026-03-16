import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

interface IAvisoGasto {
  id: number;
  concepto: string;
  nota?: string;
  clasificacion?: string;
  tipo?: string;
  zona_nombre?: string;
  propiedad_identificador?: string;
  total_bs: number;
  total_usd: number;
  cuota_bs: number;
  cuota_usd: number;
}

interface IAvisoInmueble {
  identificador: string;
  alicuota?: number;
  propietario: string;
  inquilino?: string | null;
  titular_mostrado?: string;
}

interface IAvisoSaldoCuenta {
  antes_aviso_bs: number;
  antes_aviso_usd: number;
  con_aviso_bs: number;
  con_aviso_usd: number;
}

interface IAvisoData {
  mes_correspondiente: string;
  estado_recibo?: string;
  administradora: { nombre: string; rif: string; correo: string; logo_url: string | null };
  condominio: { nombre: string; rif: string; correo: string };
  inmueble: IAvisoInmueble;
  saldo_cuenta: IAvisoSaldoCuenta;
  gastos: IAvisoGasto[];
  fondos: { id: number; banco_fondo: string; saldo_actual_bs: number; saldo_actual_usd: number; proyeccion_bs: number; proyeccion_usd: number }[];
  mensajes: string[];
}

interface ApiSuccess<T> {
  status: 'success';
  aviso?: T;
  data?: T;
  message?: string;
}

interface ApiError {
  status: 'error';
  message: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

interface VistaAvisoCobroProps {
  reciboId?: number | string | null;
}

const fallbackAvisoData: IAvisoData = {
  mes_correspondiente: 'Marzo 2026',
  estado_recibo: 'Pendiente',
  administradora: {
    nombre: 'Junta General Las Torres',
    rif: 'J123456789',
    correo: 'administracion@lastorres.com',
    logo_url: null,
  },
  condominio: {
    nombre: 'Condominio Residencias Altavista',
    rif: 'J098765432',
    correo: 'junta@altavista.org',
  },
  inmueble: {
    identificador: 'A-12',
    alicuota: 3.125,
    propietario: 'Sofia Mendoza',
    inquilino: 'Carlos Perez',
    titular_mostrado: 'Sofia Mendoza / Inquilino: Carlos Perez',
  },
  saldo_cuenta: {
    antes_aviso_bs: -25.4,
    antes_aviso_usd: -0.7,
    con_aviso_bs: 349.6,
    con_aviso_usd: 9.63,
  },
  gastos: [
    {
      id: 1,
      concepto: 'Vigilancia y Seguridad',
      nota: 'Servicio mensual integral de vigilancia.',
      clasificacion: 'Fijo',
      tipo: 'Comun',
      total_bs: 154320.5,
      total_usd: 2411.26,
      cuota_bs: 8421.85,
      cuota_usd: 131.42,
    },
    {
      id: 2,
      concepto: 'Mantenimiento de Ascensores',
      nota: 'Contrato preventivo y correctivo.',
      clasificacion: 'Variable',
      tipo: 'Zona',
      zona_nombre: 'Torre B',
      total_bs: 60210.24,
      total_usd: 940.78,
      cuota_bs: 3284.19,
      cuota_usd: 51.31,
    },
  ],
  fondos: [
    { id: 1, banco_fondo: 'Banco Nacional - Fondo Operativo', saldo_actual_bs: 482300.77, saldo_actual_usd: 7535.95, proyeccion_bs: 612411.21, proyeccion_usd: 9568.93 },
  ],
  mensajes: [
    'Recuerde que el pago oportuno evita recargos por morosidad.',
    'Puede realizar su pago por transferencia o pago movil.',
    'Si detecta inconsistencias, contacte administracion.',
    'Gracias por su colaboracion.',
  ],
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const toNumber = (value: unknown): number => parseFloat(String(value ?? 0)) || 0;
const normalizeTipo = (tipo: string | undefined): string => String(tipo || '').trim().toLowerCase();
const normalizeClasificacion = (clasificacion: string | undefined): string => String(clasificacion || '').trim().toLowerCase();
const isFixedClasificacion = (clasificacion: string | undefined): boolean => normalizeClasificacion(clasificacion).startsWith('fij');

const isNonCommonGasto = (tipo: string | undefined): boolean => {
  const t = normalizeTipo(tipo);
  return t === 'zona' || t === 'no comun' || t === 'no_comun' || t === 'individual';
};

const getScopeLabel = (gasto: IAvisoGasto): string => {
  const t = normalizeTipo(gasto.tipo);
  if (t === 'individual') return `Individual${gasto.propiedad_identificador ? ` (${gasto.propiedad_identificador})` : ''}`;
  if (t === 'zona' || t === 'no comun' || t === 'no_comun') return `Zona${gasto.zona_nombre ? ` (${gasto.zona_nombre})` : ''}`;
  return 'Comun';
};

const normalizeEstado = (estado: string | undefined): 'Pendiente' | 'Abonado' | 'Pagado' => {
  const e = String(estado || '').trim().toLowerCase();
  if (['pagado', 'solvente', 'recibo', 'validado'].includes(e)) return 'Pagado';
  if (['abonado', 'abonado parcial', 'parcial'].includes(e)) return 'Abonado';
  return 'Pendiente';
};

const estadoBadgeClass = (estado: 'Pendiente' | 'Abonado' | 'Pagado'): string => {
  if (estado === 'Pagado') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (estado === 'Abonado') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-red-100 text-red-700 border border-red-200';
};

const VistaAvisoCobro = ({ reciboId = null }: VistaAvisoCobroProps) => {
  const { id: routeReciboId } = useParams();
  const effectiveReciboId = reciboId ?? routeReciboId ?? null;
  const [avisoData, setAvisoData] = useState<IAvisoData>(fallbackAvisoData);
  const [loadingSnapshot, setLoadingSnapshot] = useState<boolean>(Boolean(effectiveReciboId));

  useEffect(() => {
    const fetchSnapshot = async (): Promise<void> => {
      if (!effectiveReciboId) {
        setLoadingSnapshot(false);
        return;
      }
      const token = localStorage.getItem('habioo_token');
      if (!token) {
        setLoadingSnapshot(false);
        return;
      }

      setLoadingSnapshot(true);

      try {
        const res = await fetch(`${API_BASE_URL}/recibos/${effectiveReciboId}/aviso`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: ApiResponse<IAvisoData> = await res.json();
        if (!res.ok || data.status !== 'success') return;

        const raw = data.aviso || data.data;
        if (!raw) return;

        const propietario = String(raw.inmueble?.propietario || 'Sin propietario');
        const inquilino = raw.inmueble?.inquilino ? String(raw.inmueble.inquilino) : null;
        const titularMostrado = String(raw.inmueble?.titular_mostrado || (inquilino ? `${propietario} / Inquilino: ${inquilino}` : propietario));

        setAvisoData({
          mes_correspondiente: String(raw.mes_correspondiente || ''),
          estado_recibo: String(raw.estado_recibo || ''),
          administradora: {
            nombre: String(raw.administradora?.nombre || ''),
            rif: String(raw.administradora?.rif || ''),
            correo: String(raw.administradora?.correo || ''),
            logo_url: raw.administradora?.logo_url || null,
          },
          condominio: {
            nombre: String(raw.condominio?.nombre || ''),
            rif: String(raw.condominio?.rif || ''),
            correo: String(raw.condominio?.correo || ''),
          },
          inmueble: {
            identificador: String(raw.inmueble?.identificador || ''),
            alicuota: toNumber(raw.inmueble?.alicuota),
            propietario,
            inquilino,
            titular_mostrado: titularMostrado,
          },
          saldo_cuenta: {
            antes_aviso_bs: toNumber(raw.saldo_cuenta?.antes_aviso_bs),
            antes_aviso_usd: toNumber(raw.saldo_cuenta?.antes_aviso_usd),
            con_aviso_bs: toNumber(raw.saldo_cuenta?.con_aviso_bs),
            con_aviso_usd: toNumber(raw.saldo_cuenta?.con_aviso_usd),
          },
          gastos: Array.isArray(raw.gastos)
            ? raw.gastos.map((g) => ({
                id: toNumber(g.id),
                concepto: String(g.concepto || ''),
                nota: String(g.nota || ''),
                clasificacion: String(g.clasificacion || 'Variable'),
                tipo: String(g.tipo || ''),
                zona_nombre: String(g.zona_nombre || ''),
                propiedad_identificador: String(g.propiedad_identificador || ''),
                total_bs: toNumber(g.total_bs),
                total_usd: toNumber(g.total_usd),
                cuota_bs: toNumber(g.cuota_bs),
                cuota_usd: toNumber(g.cuota_usd),
              }))
            : [],
          fondos: Array.isArray(raw.fondos)
            ? raw.fondos.map((f) => ({
                id: toNumber(f.id),
                banco_fondo: String(f.banco_fondo || ''),
                saldo_actual_bs: toNumber(f.saldo_actual_bs),
                saldo_actual_usd: toNumber(f.saldo_actual_usd),
                proyeccion_bs: toNumber(f.proyeccion_bs),
                proyeccion_usd: toNumber(f.proyeccion_usd),
              }))
            : [],
          mensajes: Array.isArray(raw.mensajes) ? raw.mensajes.map((m) => String(m || '')).filter((m) => m.trim().length > 0) : [],
        });
      } catch {
        // mantener fallback
      } finally {
        setLoadingSnapshot(false);
      }
    };

    void fetchSnapshot();
  }, [effectiveReciboId]);

  const totals = useMemo(
    () =>
      avisoData.gastos.reduce(
        (acc, gasto) => ({
          total_bs: acc.total_bs + gasto.total_bs,
          total_usd: acc.total_usd + gasto.total_usd,
          cuota_bs: acc.cuota_bs + gasto.cuota_bs,
          cuota_usd: acc.cuota_usd + gasto.cuota_usd,
        }),
        { total_bs: 0, total_usd: 0, cuota_bs: 0, cuota_usd: 0 },
      ),
    [avisoData.gastos],
  );

  const nonCommonGastos = useMemo(
    () => avisoData.gastos.filter((gasto) => isNonCommonGasto(gasto.tipo)),
    [avisoData.gastos],
  );

  const gastosFijos = useMemo(
    () => avisoData.gastos.filter((gasto) => isFixedClasificacion(gasto.clasificacion)),
    [avisoData.gastos],
  );

  const gastosVariables = useMemo(
    () => avisoData.gastos.filter((gasto) => !isFixedClasificacion(gasto.clasificacion)),
    [avisoData.gastos],
  );

  const estadoRecibo = normalizeEstado(avisoData.estado_recibo);

  if (loadingSnapshot) {
    return (
      <div className="min-h-[360px] bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-2xl md:p-12">
          <div className="mx-auto max-w-md rounded-2xl border border-blue-200 bg-blue-50/70 p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="mt-4 text-base font-bold text-blue-800">Cargando aviso de cobro...</p>
            <p className="mt-1 text-sm text-blue-600">Estamos preparando la informacion del recibo.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-2xl md:p-12">
        <header className="aviso-header mb-6 flex flex-col gap-6 border-b border-gray-200 pb-6 md:flex-row md:items-start md:justify-between">
          <div className="aviso-header-left min-w-0 md:w-1/4">
            {avisoData.administradora.logo_url ? (
              <img src={avisoData.administradora.logo_url} alt="Logo administradora" className="h-16 w-auto object-contain" />
            ) : (
              <div className="inline-block rounded-md bg-gray-100 px-3 py-2 text-xl font-black tracking-wide text-gray-700">HABIOO</div>
            )}
            <div className="mt-3 space-y-0.5 text-xs text-gray-500">
              <p className="font-semibold text-gray-700">{avisoData.administradora.nombre}</p>
              <p>RIF: {avisoData.administradora.rif}</p>
              <p>{avisoData.administradora.correo}</p>
            </div>
          </div>

          <div className="aviso-header-center text-center md:w-2/4">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-4xl">AVISO DE COBRO</h1>
            <p className="mt-2 text-base font-bold text-donezo-primary md:text-lg">{avisoData.mes_correspondiente}</p>
            <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${estadoBadgeClass(estadoRecibo)}`}>
              {estadoRecibo}
            </span>
          </div>

          <div className="aviso-header-right text-left md:w-1/4 md:text-right">
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-900">Condominio</h2>
            <p className="mt-1 text-sm font-bold text-gray-800">{avisoData.condominio.nombre}</p>
            <p className="text-xs text-gray-500">RIF: {avisoData.condominio.rif}</p>
            <p className="text-xs text-gray-500">{avisoData.condominio.correo}</p>
          </div>
        </header>

        <section className="aviso-top-grid mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Inmueble</p>
            <p className="mt-1 text-lg font-black text-slate-800">{avisoData.inmueble.identificador || 'N/A'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{avisoData.inmueble.titular_mostrado || avisoData.inmueble.propietario}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Alícuota: {formatMoney(toNumber(avisoData.inmueble.alicuota))}%</p>
            <p className="mt-1 text-sm font-black text-slate-700">Por alícuota en este aviso: Bs {formatMoney(totals.cuota_bs)} / $ {formatMoney(totals.cuota_usd)}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-indigo-600">Estado de Cuenta (Propietario)</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Saldo antes del aviso</p>
                <p className="font-black text-indigo-800">Bs {formatMoney(avisoData.saldo_cuenta.antes_aviso_bs)}</p>
                <p className="font-black text-indigo-800">$ {formatMoney(avisoData.saldo_cuenta.antes_aviso_usd)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Saldo con aviso generado</p>
                <p className="font-black text-indigo-800">Bs {formatMoney(avisoData.saldo_cuenta.con_aviso_bs)}</p>
                <p className="font-black text-indigo-800">$ {formatMoney(avisoData.saldo_cuenta.con_aviso_usd)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="mb-3 text-lg font-black text-gray-900">Detalle de Gastos del Mes</h3>
          <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            {nonCommonGastos.length === 0
              ? 'No hay cargos no comunes (zona/individual) en este aviso.'
              : `Este aviso incluye ${nonCommonGastos.length} cargo(s) no comun(es) (zona/individual).`}
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50 text-indigo-700">
                <tr className="text-left uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3 font-extrabold">Descripcion del Gasto</th>
                  <th className="px-4 py-3 text-right font-extrabold">Total Gasto (Bs)</th>
                  <th className="px-4 py-3 text-right font-extrabold">Total Gasto ($)</th>
                  <th className="px-4 py-3 text-right font-extrabold">Por Alícuota (Bs)</th>
                  <th className="px-4 py-3 text-right font-extrabold">Por Alícuota ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-slate-50">
                  <td colSpan={5} className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Gastos Fijos ({gastosFijos.length})
                  </td>
                </tr>
                {gastosFijos.map((gasto) => (
                  <tr key={`fijo-${gasto.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      <p className="font-semibold text-gray-800">{gasto.concepto}</p>
                      {gasto.nota ? <p className="mt-1 text-xs text-gray-500">Nota: {gasto.nota}</p> : null}
                      {isNonCommonGasto(gasto.tipo) ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">Cargo no comun: {getScopeLabel(gasto)}</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-emerald-700">Cargo comun</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">Bs {formatMoney(gasto.total_bs)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">$ {formatMoney(gasto.total_usd)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">Bs {formatMoney(gasto.cuota_bs)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">$ {formatMoney(gasto.cuota_usd)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td colSpan={5} className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Gastos Variables ({gastosVariables.length})
                  </td>
                </tr>
                {gastosVariables.map((gasto) => (
                  <tr key={gasto.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      <p className="font-semibold text-gray-800">{gasto.concepto}</p>
                      {gasto.nota ? <p className="mt-1 text-xs text-gray-500">Nota: {gasto.nota}</p> : null}
                      {isNonCommonGasto(gasto.tipo) ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">Cargo no comun: {getScopeLabel(gasto)}</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-emerald-700">Cargo comun</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">Bs {formatMoney(gasto.total_bs)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">$ {formatMoney(gasto.total_usd)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">Bs {formatMoney(gasto.cuota_bs)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">$ {formatMoney(gasto.cuota_usd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td className="px-4 py-3 font-black text-gray-900">TOTAL</td>
                  <td className="px-4 py-3 text-right font-black text-gray-900">Bs {formatMoney(totals.total_bs)}</td>
                  <td className="px-4 py-3 text-right font-black text-gray-900">$ {formatMoney(totals.total_usd)}</td>
                  <td className="px-4 py-3 text-right font-black text-gray-900">Bs {formatMoney(totals.cuota_bs)}</td>
                  <td className="px-4 py-3 text-right font-black text-gray-900">$ {formatMoney(totals.cuota_usd)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="mb-3 text-lg font-black text-emerald-600">Estado de Cuentas y Proyeccion de Fondos</h3>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-teal-50 text-teal-700">
                <tr className="text-left uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3 font-extrabold">Cuenta / Fondo</th>
                  <th className="px-4 py-3 text-right font-extrabold">Saldo Actual (Bs)</th>
                  <th className="px-4 py-3 text-right font-extrabold">Saldo Actual ($)</th>
                  <th className="px-4 py-3 text-right font-extrabold">Proyeccion al cobrar (Bs)</th>
                  <th className="px-4 py-3 text-right font-extrabold">Proyeccion al cobrar ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {avisoData.fondos.map((fondo) => (
                  <tr key={fondo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700">{fondo.banco_fondo}</td>
                    <td className="px-4 py-3 text-right text-gray-700">Bs {formatMoney(fondo.saldo_actual_bs)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">$ {formatMoney(fondo.saldo_actual_usd)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">Bs {formatMoney(fondo.proyeccion_bs)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">$ {formatMoney(fondo.proyeccion_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-black text-gray-900">Mensajes Importantes</h3>
          <div className="aviso-mensajes-grid grid grid-cols-1 gap-3 md:grid-cols-2">
            {(avisoData.mensajes.length > 0 ? avisoData.mensajes : fallbackAvisoData.mensajes).map((mensaje, index) => (
              <div key={index} className="rounded-md border-l-4 border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-800">
                {mensaje}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default VistaAvisoCobro;
