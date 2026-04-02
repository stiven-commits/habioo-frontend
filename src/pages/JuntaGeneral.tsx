import { useEffect, useMemo, useState, type FC } from 'react';
import { API_BASE_URL } from '../config/api';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/ui/StatusBadge';
import { useDialog } from '../components/ui/DialogProvider';

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
  vinculado_at?: string | null;
  activo: boolean;
  es_fantasma: boolean;
}

interface ApiResp<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

interface PerfilData {
  rif?: string | null;
}

type EstadoMiembro = 'PENDIENTE' | 'VINCULADO' | 'EXPIRADO' | 'INACTIVO';

const toMoney = (value: number): string => Number(value || 0).toFixed(2);

const normalizeJuntaRif = (value: string): string => {
  const raw = String(value || '').toUpperCase().replace(/[^J0-9]/g, '');
  if (!raw) return '';
  const digits = raw.replace(/^J/, '').replace(/\D/g, '').slice(0, 9);
  return `J${digits}`;
};

const formatAlicuotaInput = (value: string): string => {
  const normalized = String(value || '').replace(/\./g, ',').replace(/[^0-9,]/g, '');
  if (!normalized) return '';

  const firstCommaIndex = normalized.indexOf(',');
  const wholeRaw = firstCommaIndex >= 0 ? normalized.slice(0, firstCommaIndex) : normalized;
  const decimalRaw = firstCommaIndex >= 0 ? normalized.slice(firstCommaIndex + 1).replace(/,/g, '') : '';

  const whole = wholeRaw.slice(0, 3);
  const decimal = decimalRaw.slice(0, 6);

  if (firstCommaIndex >= 0) {
    return decimal.length > 0 ? `${whole},${decimal}` : `${whole},`;
  }

  return whole;
};

const parseAlicuotaInput = (value: string): number | null => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  const parsed = Number(clean.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidJuntaRif = (value: string): boolean => /^J[0-9]+$/.test(value);

const isExpired = (value?: string | null): boolean => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
};

const getMiembroEstado = (miembro: MiembroRow): EstadoMiembro => {
  if (!miembro.activo) return 'INACTIVO';
  if (miembro.condominio_individual_id) return 'VINCULADO';
  if (miembro.codigo_invitacion && isExpired(miembro.codigo_expira_at)) return 'EXPIRADO';
  return 'PENDIENTE';
};

const estadoBadge = (estado: EstadoMiembro) => {
  if (estado === 'VINCULADO') return <StatusBadge color="emerald" border>Vinculada</StatusBadge>;
  if (estado === 'EXPIRADO') return <StatusBadge color="amber" border>Código vencido</StatusBadge>;
  if (estado === 'INACTIVO') return <StatusBadge color="gray" border>Inactiva</StatusBadge>;
  return <StatusBadge color="blue" border>Pendiente por vincular</StatusBadge>;
};

const estadoCuentaBadge = (estado: string) => {
  if (estado === 'SOLVENTE') return <StatusBadge color="emerald" border>{estado}</StatusBadge>;
  if (estado === 'ABONADO') return <StatusBadge color="amber" border>{estado}</StatusBadge>;
  return <StatusBadge color="red" border>{estado}</StatusBadge>;
};

const JuntaGeneral: FC = () => {
  const { showAlert, showConfirm } = useDialog();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [metricas, setMetricas] = useState<JuntaMetricas | null>(null);
  const [resumen, setResumen] = useState<JuntaResumenRow[]>([]);
  const [miembros, setMiembros] = useState<MiembroRow[]>([]);
  const [rifGeneral, setRifGeneral] = useState<string>('');

  const [nombre, setNombre] = useState<string>('');
  const [rif, setRif] = useState<string>('');
  const [cuota, setCuota] = useState<string>('');

  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | EstadoMiembro>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState<string>('');
  const [editRif, setEditRif] = useState<string>('');
  const [editCuota, setEditCuota] = useState<string>('');

  const [workingId, setWorkingId] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const token = useMemo(() => localStorage.getItem('habioo_token') || '', []);

  const fetchData = async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const [resResumen, resMiembros, resPerfil] = await Promise.all([
        fetch(`${API_BASE_URL}/juntas-generales/resumen`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/juntas-generales/miembros?include_inactivos=true`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/perfil`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataResumen: ApiResp<{ juntas: JuntaResumenRow[]; metricas: JuntaMetricas }> = await resResumen.json();
      const dataMiembros: ApiResp<MiembroRow[]> = await resMiembros.json();
      const dataPerfil: ApiResp<PerfilData> = await resPerfil.json();

      if (!resResumen.ok || dataResumen.status !== 'success') {
        setError(dataResumen.message || 'No se pudo cargar el resumen de junta general.');
        return;
      }
      if (!resMiembros.ok || dataMiembros.status !== 'success') {
        setError(dataMiembros.message || 'No se pudo cargar la lista de juntas individuales.');
        return;
      }
      if (!resPerfil.ok || dataPerfil.status !== 'success') {
        const msg = dataPerfil.message || 'No se pudo cargar el RIF de la junta general para validar duplicados.';
        setError(msg);
        void showAlert({ title: 'Validación incompleta', message: msg, variant: 'warning' });
        return;
      }

      setResumen(dataResumen.data?.juntas || []);
      setMetricas(dataResumen.data?.metricas || null);
      setMiembros(dataMiembros.data || []);
      setRifGeneral(normalizeJuntaRif(dataPerfil.data?.rif || ''));
    } catch {
      setError('Error de conexión al cargar la vista de junta general.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const miembrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return miembros.filter((m) => {
      const estado = getMiembroEstado(m);
      const byEstado = filtroEstado === 'TODOS' || estado === filtroEstado;
      const byQuery = !q
        || m.nombre_referencia.toLowerCase().includes(q)
        || String(m.rif || '').toLowerCase().includes(q);
      return byEstado && byQuery;
    });
  }, [miembros, busqueda, filtroEstado]);

  const resetCrear = (): void => {
    setNombre('');
    setRif('');
    setCuota('');
  };

  const startEditing = (row: MiembroRow): void => {
    setEditingId(row.id);
    setEditNombre(row.nombre_referencia);
    setEditRif(normalizeJuntaRif(row.rif));
    setEditCuota(
      String(Number(row.cuota_participacion || 0).toFixed(6))
        .replace(/\.0+$/, '')
        .replace(/(\.\d*?)0+$/, '$1')
        .replace('.', ',')
    );
    setError('');
    setSuccess('');
  };

  const cancelEditing = (): void => {
    setEditingId(null);
    setEditNombre('');
    setEditRif('');
    setEditCuota('');
  };

  const handleCrear = async (): Promise<void> => {
    if (!nombre.trim() || !rif.trim()) {
      const msg = 'Debes indicar nombre y RIF de la junta individual.';
      setError(msg);
      void showAlert({ title: 'Datos incompletos', message: msg, variant: 'warning' });
      return;
    }
    if (!isValidJuntaRif(normalizeJuntaRif(rif))) {
      const msg = 'El RIF debe comenzar con J y contener solo números luego del prefijo.';
      setError(msg);
      void showAlert({ title: 'RIF inválido', message: msg, variant: 'warning' });
      return;
    }
    if (!rifGeneral) {
      const msg = 'Debes configurar el RIF de la Junta General en Perfil antes de registrar juntas individuales.';
      setError(msg);
      void showAlert({ title: 'Falta configuración', message: msg, variant: 'warning' });
      return;
    }
    if (rifGeneral && normalizeJuntaRif(rif) === rifGeneral) {
      const msg = 'No puedes registrar una junta individual con el mismo RIF de la Junta General.';
      setError(msg);
      void showAlert({ title: 'RIF duplicado', message: msg, variant: 'danger' });
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/miembros`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre_referencia: nombre.trim(),
          rif: normalizeJuntaRif(rif),
          cuota_participacion: parseAlicuotaInput(cuota),
        }),
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo registrar la junta individual.');
        return;
      }

      resetCrear();
      setSuccess('Miembro registrado correctamente.');
      await fetchData();
    } catch {
      setError('Error de conexión al crear la junta individual.');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarEdicion = async (): Promise<void> => {
    if (!editingId) return;
    if (!editNombre.trim() || !editRif.trim()) {
      const msg = 'Para guardar, indica nombre y RIF válidos.';
      setError(msg);
      void showAlert({ title: 'Datos incompletos', message: msg, variant: 'warning' });
      return;
    }
    if (!isValidJuntaRif(normalizeJuntaRif(editRif))) {
      const msg = 'El RIF debe comenzar con J y contener solo números luego del prefijo.';
      setError(msg);
      void showAlert({ title: 'RIF inválido', message: msg, variant: 'warning' });
      return;
    }
    if (!rifGeneral) {
      const msg = 'Debes configurar el RIF de la Junta General en Perfil antes de editar vinculaciones.';
      setError(msg);
      void showAlert({ title: 'Falta configuración', message: msg, variant: 'warning' });
      return;
    }
    if (rifGeneral && normalizeJuntaRif(editRif) === rifGeneral) {
      const msg = 'No puedes usar el mismo RIF de la Junta General.';
      setError(msg);
      void showAlert({ title: 'RIF duplicado', message: msg, variant: 'danger' });
      return;
    }

    setWorkingId(editingId);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/miembros/${editingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre_referencia: editNombre.trim(),
          rif: normalizeJuntaRif(editRif),
          cuota_participacion: parseAlicuotaInput(editCuota),
        }),
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo actualizar la junta individual.');
        return;
      }

      cancelEditing();
      setSuccess('Miembro actualizado correctamente.');
      await fetchData();
    } catch {
      setError('Error de conexión al actualizar la junta individual.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleDesactivar = async (row: MiembroRow): Promise<void> => {
    const confirmed = await showConfirm({
      title: 'Eliminar vínculo',
      message: `¿Deseas eliminar el vínculo de ${row.nombre_referencia}? Si tiene historial, quedará inactiva para conservar trazabilidad.`,
      confirmText: 'Sí, continuar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!confirmed) return;

    setWorkingId(row.id);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/miembros/${row.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo desactivar el miembro.');
        return;
      }

      setSuccess(data.message || 'Vinculación actualizada correctamente.');
      await fetchData();
    } catch {
      setError('Error de conexión al desactivar el miembro.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleReactivar = async (row: MiembroRow): Promise<void> => {
    setWorkingId(row.id);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/miembros`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre_referencia: row.nombre_referencia,
          rif: normalizeJuntaRif(row.rif),
          cuota_participacion: row.cuota_participacion,
        }),
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo reactivar el miembro.');
        return;
      }

      setSuccess('Miembro reactivado correctamente.');
      await fetchData();
    } catch {
      setError('Error de conexión al reactivar el miembro.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleGenerarInvitacion = async (id: number): Promise<void> => {
    setWorkingId(id);
    setError('');
    setSuccess('');
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
      setSuccess('Código de invitación generado correctamente.');
      await fetchData();
    } catch {
      setError('Error de conexión al generar el código de invitación.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleCopiarCodigo = async (codigo: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(codigo);
      setSuccess('Código copiado al portapapeles.');
    } catch {
      setError('No se pudo copiar el código.');
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
          Aquí puedes gestionar las juntas individuales asociadas a esta junta general.
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
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Si la junta ya existe en Habioo, se vincula automáticamente por RIF.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="md:col-span-5 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Nombre de la junta
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Torre Norte"
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="md:col-span-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
            RIF
            <input
              value={rif}
              onChange={(e) => setRif(normalizeJuntaRif(e.target.value))}
              placeholder="J123456789"
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Alícuota (%)
            <input
              value={cuota}
              onChange={(e) => setCuota(formatAlicuotaInput(e.target.value))}
              placeholder="20,5"
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-right text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => { void handleCrear(); }}
              className="h-11 w-full rounded-xl bg-donezo-primary px-4 font-black text-white disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Estado de Cuenta por Junta</h4>
        <DataTable
          tableStyle={{ minWidth: '920px' }}
          data={resumen}
          keyExtractor={(row) => row.miembro_id}
          columns={[
            { key: 'junta', header: 'Junta Individual', className: 'font-semibold', render: (row) => row.nombre_junta_individual },
            { key: 'rif', header: 'RIF', className: 'font-mono', render: (row) => row.rif || '-' },
            { key: 'estado', header: 'Estado Cuenta', render: (row) => estadoCuentaBadge(row.estado_cuenta) },
            { key: 'generado', header: 'Generado USD', headerClassName: 'text-right', className: 'text-right', render: (row) => toMoney(row.saldo_usd_generado) },
            { key: 'pagado', header: 'Pagado USD', headerClassName: 'text-right', className: 'text-right text-emerald-600', render: (row) => toMoney(row.saldo_usd_pagado) },
            { key: 'pendiente', header: 'Pendiente USD', headerClassName: 'text-right', className: 'text-right text-red-600', render: (row) => toMoney(row.saldo_usd_pendiente) },
            { key: 'morosidad', header: '% Morosidad', headerClassName: 'text-right', className: 'text-right', render: (row) => `${row.porcentaje_morosidad.toFixed(2)}%` },
          ]}
        />
      </article>

      <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white">Vinculación de Juntas</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Revisa el estado de cada junta y comparte códigos de vinculación.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o RIF"
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as 'TODOS' | EstadoMiembro)}
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="VINCULADO">Vinculado</option>
              <option value="EXPIRADO">Expirado</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <DataTable
            tableStyle={{ minWidth: '1160px' }}
            data={miembrosFiltrados}
            keyExtractor={(row) => row.id}
            columns={[
              { key: 'nombre', header: 'Junta', className: 'font-semibold', render: (row) => row.nombre_referencia },
              { key: 'rif', header: 'RIF', className: 'font-mono', render: (row) => row.rif },
              { key: 'cuota', header: 'Alícuota %', headerClassName: 'text-right', className: 'text-right', render: (row) => Number(row.cuota_participacion || 0).toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') },
              { key: 'estado', header: 'Estado', render: (row) => estadoBadge(getMiembroEstado(row)) },
              {
                key: 'codigo',
                header: 'Código de vinculación',
                className: 'font-mono text-xs',
                render: (row) => row.codigo_invitacion ? (
                  <div className="flex items-center gap-2">
                    <span>{row.codigo_invitacion}</span>
                    <button
                      type="button"
                      onClick={() => { void handleCopiarCodigo(row.codigo_invitacion || ''); }}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-black uppercase text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      Copiar
                    </button>
                  </div>
                ) : '-'
              },
              {
                key: 'expira',
                header: 'Expira',
                className: 'text-xs',
                render: (row) => row.codigo_expira_at ? new Date(row.codigo_expira_at).toLocaleDateString('es-VE') : '-',
              },
              {
                key: 'acciones',
                header: 'Acciones',
                headerClassName: 'text-right',
                className: 'text-right',
                render: (row) => {
                  const estado = getMiembroEstado(row);
                  const isBusy = workingId === row.id;
                  return (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(row)}
                        disabled={isBusy}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        Editar
                      </button>
                      {estado !== 'INACTIVO' ? (
                        <>
                          {!row.condominio_individual_id && (
                            <button
                              type="button"
                              onClick={() => { void handleGenerarInvitacion(row.id); }}
                              disabled={isBusy}
                              className="rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {isBusy ? 'Generando...' : 'Código'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { void handleDesactivar(row); }}
                            disabled={isBusy}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                          >
                            Eliminar vínculo
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { void handleReactivar(row); }}
                          disabled={isBusy}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      </article>

      {editingId !== null && (
        <article className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-lg font-black text-gray-900 dark:text-white">Editar Miembro #{editingId}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">Actualiza nombre, RIF y alícuota sin perder trazabilidad.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <label className="md:col-span-5 text-xs font-semibold text-gray-600 dark:text-gray-300">
              Nombre
              <input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="md:col-span-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
              RIF
              <input
                value={editRif}
                onChange={(e) => setEditRif(normalizeJuntaRif(e.target.value))}
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              Alícuota (%)
              <input
                value={editCuota}
                onChange={(e) => setEditCuota(formatAlicuotaInput(e.target.value))}
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-right text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                onClick={() => { void handleGuardarEdicion(); }}
                disabled={workingId === editingId}
                className="h-11 flex-1 rounded-xl bg-blue-600 px-3 text-sm font-black text-white disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={workingId === editingId}
                className="h-11 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-sm font-black text-gray-700 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </article>
      )}

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-600">{success}</p> : null}
    </section>
  );
};

export default JuntaGeneral;

