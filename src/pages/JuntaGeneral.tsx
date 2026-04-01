import { useEffect, useMemo, useState, type FC } from 'react';
import { API_BASE_URL } from '../config/api';
import DataTable from '../components/ui/DataTable';

interface JuntaResumenRow {
  miembro_id: number;
  nombre_junta_individual: string;
  rif: string;
  vinculada: boolean;
  cuota_participacion: number;
  saldo_usd_generado: number;
  saldo_usd_pagado: number;
  saldo_usd_pendiente: number;
  porcentaje_morosidad: number;
  estado_cuenta: 'SOLVENTE' | 'ABONADO' | 'PENDIENTE' | string;
}

interface JuntaMetricas {
  total_juntas: number;
  total_vinculadas: number;
  total_usd_generado: number;
  total_usd_pagado: number;
  total_usd_pendiente: number;
  porcentaje_morosidad_global: number;
}

interface MiembroRow {
  id: number;
  nombre_referencia: string;
  rif: string;
  cuota_participacion: number;
  condominio_individual_id: number | null;
  codigo_invitacion?: string | null;
  codigo_expira_at?: string | null;
}

interface ApiResp<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

const toMoney = (value: number): string => Number(value || 0).toFixed(2);

const JuntaGeneral: FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [metricas, setMetricas] = useState<JuntaMetricas | null>(null);
  const [resumen, setResumen] = useState<JuntaResumenRow[]>([]);
  const [miembros, setMiembros] = useState<MiembroRow[]>([]);
  const [nombre, setNombre] = useState<string>('');
  const [rif, setRif] = useState<string>('');
  const [cuota, setCuota] = useState<string>('');
  const [workingId, setWorkingId] = useState<number | null>(null);

  const token = useMemo(() => localStorage.getItem('habioo_token') || '', []);

  const fetchData = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const [resResumen, resMiembros] = await Promise.all([
        fetch(`${API_BASE_URL}/juntas-generales/resumen`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/juntas-generales/miembros`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataResumen: ApiResp<{ juntas: JuntaResumenRow[]; metricas: JuntaMetricas }> = await resResumen.json();
      const dataMiembros: ApiResp<MiembroRow[]> = await resMiembros.json();

      if (!resResumen.ok || dataResumen.status !== 'success') {
        setError(dataResumen.message || 'No se pudo cargar el resumen de junta general.');
        return;
      }
      if (!resMiembros.ok || dataMiembros.status !== 'success') {
        setError(dataMiembros.message || 'No se pudo cargar la lista de juntas individuales.');
        return;
      }

      setResumen(dataResumen.data?.juntas || []);
      setMetricas(dataResumen.data?.metricas || null);
      setMiembros(dataMiembros.data || []);
    } catch {
      setError('Error de conexión al cargar la vista de junta general.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleCrear = async (): Promise<void> => {
    if (!nombre.trim() || !rif.trim()) {
      setError('Debes indicar nombre y RIF de la junta individual.');
      return;
    }

    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/miembros`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre_referencia: nombre.trim(),
          rif: rif.trim(),
          cuota_participacion: cuota.trim() ? Number(cuota) : null,
        }),
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo registrar la junta individual.');
        return;
      }

      setNombre('');
      setRif('');
      setCuota('');
      await fetchData();
    } catch {
      setError('Error de conexión al crear la junta individual.');
    }
  };

  const handleGenerarInvitacion = async (id: number): Promise<void> => {
    setWorkingId(id);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/miembros/${id}/invitacion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResp<{ codigo_invitacion: string; expira_at: string }> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo generar el código de invitación.');
        return;
      }
      await fetchData();
    } catch {
      setError('Error de conexión al generar el código de invitación.');
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) {
    return <p className="p-6 text-gray-500 dark:text-gray-400">Cargando vista de junta general...</p>;
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h3 className="text-xl font-black text-gray-900 dark:text-white">Junta General</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Esta vista consolida el estado de cuenta entre Junta General y Juntas Individuales, sin mostrar detalle de inmuebles.
        </p>

        {metricas && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Juntas</p><p className="text-lg font-black">{metricas.total_juntas}</p></div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Vinculadas</p><p className="text-lg font-black">{metricas.total_vinculadas}</p></div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Generado USD</p><p className="text-lg font-black">{toMoney(metricas.total_usd_generado)}</p></div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Pagado USD</p><p className="text-lg font-black text-emerald-600">{toMoney(metricas.total_usd_pagado)}</p></div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Pendiente USD</p><p className="text-lg font-black text-red-600">{toMoney(metricas.total_usd_pendiente)}</p></div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Morosidad Global</p><p className="text-lg font-black">{metricas.porcentaje_morosidad_global.toFixed(2)}%</p></div>
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Registrar Junta Individual</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre junta individual" className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          <input value={rif} onChange={(e) => setRif(e.target.value)} placeholder="RIF" className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          <input value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder="Cuota (%)" className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          <button type="button" onClick={() => { void handleCrear(); }} className="h-11 rounded-xl bg-donezo-primary px-4 font-black text-white">Agregar</button>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Estado por Junta Individual</h4>
        <DataTable
          tableStyle={{ minWidth: '920px' }}
          data={resumen}
          keyExtractor={(row) => row.miembro_id}
          columns={[
            { key: 'junta', header: 'Junta Individual', className: 'font-semibold', render: (row) => row.nombre_junta_individual },
            { key: 'rif', header: 'RIF', className: 'font-mono', render: (row) => row.rif || '-' },
            { key: 'estado', header: 'Estado Cuenta', render: (row) => row.estado_cuenta },
            { key: 'generado', header: 'Generado USD', headerClassName: 'text-right', className: 'text-right', render: (row) => toMoney(row.saldo_usd_generado) },
            { key: 'pagado', header: 'Pagado USD', headerClassName: 'text-right', className: 'text-right text-emerald-600', render: (row) => toMoney(row.saldo_usd_pagado) },
            { key: 'pendiente', header: 'Pendiente USD', headerClassName: 'text-right', className: 'text-right text-red-600', render: (row) => toMoney(row.saldo_usd_pendiente) },
            { key: 'morosidad', header: '% Morosidad', headerClassName: 'text-right', className: 'text-right', render: (row) => `${row.porcentaje_morosidad.toFixed(2)}%` },
          ]}
        />
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Vinculación por Código</h4>
        <DataTable
          tableStyle={{ minWidth: '920px' }}
          data={miembros}
          keyExtractor={(row) => row.id}
          columns={[
            { key: 'nombre', header: 'Junta', className: 'font-semibold', render: (row) => row.nombre_referencia },
            { key: 'rif', header: 'RIF', className: 'font-mono', render: (row) => row.rif },
            { key: 'cuota', header: 'Cuota %', headerClassName: 'text-right', className: 'text-right', render: (row) => Number(row.cuota_participacion || 0).toFixed(3) },
            { key: 'vinculada', header: 'Vinculada', render: (row) => row.condominio_individual_id ? 'Sí' : 'No' },
            { key: 'codigo', header: 'Código Invitación', className: 'font-mono', render: (row) => row.codigo_invitacion || '-' },
            {
              key: 'accion',
              header: 'Acción',
              headerClassName: 'text-right',
              className: 'text-right',
              render: (row) => (
                <button
                  type="button"
                  onClick={() => { void handleGenerarInvitacion(row.id); }}
                  disabled={workingId === row.id}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {workingId === row.id ? 'Generando...' : 'Generar Código'}
                </button>
              ),
            },
          ]}
        />
      </article>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </section>
  );
};

export default JuntaGeneral;
