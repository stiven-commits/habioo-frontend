import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { API_BASE_URL } from '../config/api';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/ui/StatusBadge';
import EstadoConciliacionBadge from '../components/junta-general/EstadoConciliacionBadge';
import { useDialog } from '../components/ui/DialogProvider';
import DatePicker from '../components/ui/DatePicker';
import SearchableCombobox, { type SearchableComboboxOption } from '../components/ui/SearchableCombobox';
import { useSearchParams } from 'react-router-dom';

interface JuntaResumenRow {
  miembro_id: number;
  nombre_junta_individual: string;
  rif: string;
  vinculada: boolean;
  cuota_participacion: number;
  saldo_usd_generado: number;
  saldo_usd_pagado: number;
  saldo_usd_pendiente: number;
  saldo_bs_generado: number;
  saldo_bs_pagado: number;
  saldo_bs_pendiente: number;
  porcentaje_morosidad: number;
  estado_cuenta: 'SOLVENTE' | 'ABONADO' | 'PENDIENTE' | string;
}

interface JuntaMetricas {
  total_juntas: number;
  total_vinculadas: number;
  total_usd_generado: number;
  total_usd_pagado: number;
  total_usd_pendiente: number;
  total_bs_generado: number;
  total_bs_pagado: number;
  total_bs_pendiente: number;
  porcentaje_morosidad_global: number;
}

interface ConciliacionRow {
  detalle_id: number;
  aviso_id: number;
  mes_origen: string;
  miembro_id: number | null;
  junta_nombre: string;
  rif: string | null;
  gasto_id: number | null;
  concepto: string | null;
  monto_usd: number;
  monto_bs: number;
  pagado_usd: number;
  pagado_bs: number;
  pendiente_usd: number;
  pendiente_bs: number;
  estado_detalle: string | null;
  estado_conciliacion: 'CONCILIADO' | 'ABONADO' | 'PENDIENTE' | 'PENDIENTE_VINCULACION' | string;
}

interface ConciliacionMetricas {
  total_registros: number;
  total_monto_usd: number;
  total_monto_bs: number;
  total_pagado_usd: number;
  total_pagado_bs: number;
  total_pendiente_usd: number;
  total_pendiente_bs: number;
}

interface MiembroRow {
  id: number;
  nombre_referencia: string;
  rif: string;
  cuota_participacion: number;
  zona_id?: number | null;
  zona_nombre?: string | null;
  condominio_individual_id: number | null;
  codigo_invitacion?: string | null;
  codigo_expira_at?: string | null;
  vinculado_at?: string | null;
  activo: boolean;
  es_fantasma: boolean;
  has_historial_avisos?: boolean;
}

interface ApiResp<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

interface PerfilData {
  rif?: string | null;
}

interface ZonaItem {
  id: number;
  nombre: string;
  activa: boolean;
}

interface JuntaGeneralNotificacionRow {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at?: string;
}

interface JuntaGeneralAuditoriaRow {
  id: number;
  accion: string;
  created_at?: string;
  actor_nombre?: string | null;
  actor_condominio_nombre?: string | null;
  detalle_jsonb?: Record<string, unknown> | null;
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

const estadoConciliacionBadge = (estado: string) => {
  return <EstadoConciliacionBadge estado={estado} />;
};

const humanizeAuditoriaAccion = (value: string): string => {
  const raw = String(value || '').trim().toUpperCase();
  const map: Record<string, string> = {
    MIEMBRO_CREADO: 'Registro de junta individual',
    MIEMBRO_ACTUALIZADO: 'Actualización de junta individual',
    MIEMBRO_ELIMINADO: 'Eliminación de vínculo',
    INVITACION_GENERADA: 'Código de vinculación generado',
    INVITACION_ACEPTADA: 'Código de vinculación aceptado',
  };
  return map[raw] || raw.replace(/_/g, ' ');
};

const toYm = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const ymToDate = (value: string): Date | null => {
  const [yearRaw, monthRaw] = String(value || '').split('-');
  const year = parseInt(yearRaw || '', 10);
  const month = parseInt(monthRaw || '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
};

const JuntaGeneral: FC = () => {
  const { showAlert, showConfirm } = useDialog();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [metricas, setMetricas] = useState<JuntaMetricas | null>(null);
  const [resumen, setResumen] = useState<JuntaResumenRow[]>([]);
  const [miembros, setMiembros] = useState<MiembroRow[]>([]);
  const [zonas, setZonas] = useState<ZonaItem[]>([]);
  const [rifGeneral, setRifGeneral] = useState<string>('');
  const [filtroMesConciliacion, setFiltroMesConciliacion] = useState<string>(() => String(searchParams.get('mes') || '').trim());
  const [filtroMiembroConciliacion, setFiltroMiembroConciliacion] = useState<string>('');
  const [filtroEstadoConciliacion, setFiltroEstadoConciliacion] = useState<string>(() => String(searchParams.get('estado') || '').trim().toUpperCase());
  const [loadingConciliacion, setLoadingConciliacion] = useState<boolean>(false);
  const [conciliacionError, setConciliacionError] = useState<string>('');
  const [conciliacionRows, setConciliacionRows] = useState<ConciliacionRow[]>([]);
  const [conciliacionMetricas, setConciliacionMetricas] = useState<ConciliacionMetricas | null>(null);
  const [notificaciones, setNotificaciones] = useState<JuntaGeneralNotificacionRow[]>([]);
  const [notificacionesLoading, setNotificacionesLoading] = useState<boolean>(false);
  const [auditoriaRows, setAuditoriaRows] = useState<JuntaGeneralAuditoriaRow[]>([]);
  const [auditoriaLoading, setAuditoriaLoading] = useState<boolean>(false);

  const [nombre, setNombre] = useState<string>('');
  const [rif, setRif] = useState<string>('');
  const [cuota, setCuota] = useState<string>('');
  const [zonaId, setZonaId] = useState<string>('');

  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | EstadoMiembro>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState<string>('');
  const [editRif, setEditRif] = useState<string>('');
  const [editCuota, setEditCuota] = useState<string>('');
  const [editZonaId, setEditZonaId] = useState<string>('');

  const [workingId, setWorkingId] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const conciliacionSectionRef = useRef<HTMLElement | null>(null);

  const token = useMemo(() => localStorage.getItem('habioo_token') || '', []);
  const filtroMesConciliacionDate = useMemo(() => ymToDate(filtroMesConciliacion), [filtroMesConciliacion]);
  const opcionesJuntasConciliacion = useMemo<SearchableComboboxOption[]>(
    () => [
      { value: '', label: 'Todas las juntas', searchText: 'todas' },
      ...miembros
        .filter((m) => m.activo !== false)
        .map((m) => ({
          value: String(m.id),
          label: m.nombre_referencia,
          searchText: `${m.rif || ''} ${m.nombre_referencia || ''}`,
        })),
    ],
    [miembros]
  );

  const fetchConciliacion = async (
    mes: string = filtroMesConciliacion,
    miembroId: string = filtroMiembroConciliacion,
    estado: string = filtroEstadoConciliacion
  ): Promise<void> => {
    setLoadingConciliacion(true);
    setConciliacionError('');
    try {
      const params = new URLSearchParams();
      if (mes) params.set('mes', mes);
      if (miembroId) params.set('miembro_id', miembroId);
      if (estado) params.set('estado', estado);
      const query = params.toString();
      const resConciliacion = await fetch(`${API_BASE_URL}/juntas-generales/conciliacion${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const rawText = await resConciliacion.text();
      let dataConciliacion: ApiResp<{ metricas: ConciliacionMetricas; registros: ConciliacionRow[] }> | null = null;
      try {
        dataConciliacion = rawText ? JSON.parse(rawText) as ApiResp<{ metricas: ConciliacionMetricas; registros: ConciliacionRow[] }> : null;
      } catch {
        dataConciliacion = null;
      }

      if (!resConciliacion.ok || !dataConciliacion || dataConciliacion.status !== 'success') {
        const msg = dataConciliacion?.message || 'No se pudo cargar la conciliación en este momento.';
        setConciliacionError(msg);
        setConciliacionRows([]);
        setConciliacionMetricas(null);
        return;
      }
      setConciliacionMetricas(dataConciliacion.data?.metricas || null);
      setConciliacionRows(dataConciliacion.data?.registros || []);
    } catch {
      setConciliacionError('Error de conexión al cargar conciliación.');
      setConciliacionRows([]);
      setConciliacionMetricas(null);
    } finally {
      setLoadingConciliacion(false);
    }
  };

  const fetchData = async (): Promise<void> => {
    setLoading(true);
    setError('');
    setNotificacionesLoading(true);
    setAuditoriaLoading(true);
    try {
      const [resResumen, resMiembros, resPerfil, resZonas, resNotifs, resAuditoria] = await Promise.all([
        fetch(`${API_BASE_URL}/juntas-generales/resumen`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/juntas-generales/miembros?include_inactivos=true`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/perfil`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/zonas`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/juntas-generales/notificaciones`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/juntas-generales/auditoria?limit=40`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const dataResumen: ApiResp<{ juntas: JuntaResumenRow[]; metricas: JuntaMetricas }> = await resResumen.json();
      const dataMiembros: ApiResp<MiembroRow[]> = await resMiembros.json();
      const dataPerfil: ApiResp<PerfilData> = await resPerfil.json();
      const dataZonas = await resZonas.json();
      const notifsText = await resNotifs.text();
      const auditoriaText = await resAuditoria.text();
      const dataNotifs: ApiResp<JuntaGeneralNotificacionRow[]> | null = (() => {
        try {
          return notifsText ? JSON.parse(notifsText) as ApiResp<JuntaGeneralNotificacionRow[]> : null;
        } catch {
          return null;
        }
      })();
      const dataAuditoria: ApiResp<JuntaGeneralAuditoriaRow[]> | null = (() => {
        try {
          return auditoriaText ? JSON.parse(auditoriaText) as ApiResp<JuntaGeneralAuditoriaRow[]> : null;
        } catch {
          return null;
        }
      })();

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
      setZonas(Array.isArray(dataZonas?.zonas) ? dataZonas.zonas : []);
      if (resNotifs.ok && dataNotifs?.status === 'success') {
        setNotificaciones(Array.isArray(dataNotifs.data) ? dataNotifs.data : []);
      } else {
        setNotificaciones([]);
      }
      if (resAuditoria.ok && dataAuditoria?.status === 'success') {
        setAuditoriaRows(Array.isArray(dataAuditoria.data) ? dataAuditoria.data : []);
      } else {
        setAuditoriaRows([]);
      }
      await fetchConciliacion(filtroMesConciliacion, filtroMiembroConciliacion, filtroEstadoConciliacion);
    } catch {
      setError('Error de conexión al cargar la vista de junta general.');
    } finally {
      setLoading(false);
      setNotificacionesLoading(false);
      setAuditoriaLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    const tab = String(searchParams.get('tab') || '').trim().toLowerCase();
    if (tab !== 'conciliacion') return;
    window.setTimeout(() => {
      conciliacionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [searchParams]);

  useEffect(() => {
    if (!loading) {
      void fetchConciliacion(filtroMesConciliacion, filtroMiembroConciliacion, filtroEstadoConciliacion);
    }
  }, [filtroMesConciliacion, filtroMiembroConciliacion, filtroEstadoConciliacion]);

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
    setZonaId('');
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
    setEditZonaId(row.zona_id ? String(row.zona_id) : '');
    setError('');
    setSuccess('');
  };

  const cancelEditing = (): void => {
    setEditingId(null);
    setEditNombre('');
    setEditRif('');
    setEditCuota('');
    setEditZonaId('');
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
          zona_id: zonaId ? Number(zonaId) : null,
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
          zona_id: editZonaId ? Number(editZonaId) : null,
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
          zona_id: row.zona_id ?? null,
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

  const handleMarcarNotificacionLeida = async (id: number): Promise<void> => {
    setWorkingId(id);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/notificaciones/${id}/leida`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudo actualizar la notificación.');
        return;
      }
      setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
    } catch {
      setError('Error de conexión al actualizar la notificación.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleMarcarTodasLeidas = async (): Promise<void> => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/juntas-generales/notificaciones/leidas/todas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResp<Record<string, unknown>> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setError(data.message || 'No se pudieron marcar las notificaciones.');
        return;
      }
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setSuccess('Notificaciones marcadas como leídas.');
    } catch {
      setError('Error de conexión al marcar notificaciones.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-gray-500 dark:text-gray-400">Cargando vista de junta general...</p>;
  }

  const panelClass = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark';
  const metricCardClass = 'rounded-xl border border-emerald-100/70 bg-gradient-to-b from-emerald-50/80 to-white p-3 dark:border-emerald-900/40 dark:from-emerald-900/20 dark:to-gray-900/40';

  return (
    <section className="space-y-6" data-testid="junta-general-page">
      <article className={`${panelClass} relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-12 h-36 w-36 rounded-full bg-cyan-500/10 blur-2xl" />
        <h3 className="text-xl font-black tracking-tight text-gray-900 dark:text-white" data-testid="junta-general-title">Junta General</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Aquí puedes gestionar las juntas individuales asociadas a esta junta general.
        </p>

        {metricas && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className={metricCardClass}><p className="text-xs text-gray-500">Juntas</p><p className="text-lg font-black">{metricas.total_juntas}</p></div>
            <div className={metricCardClass}><p className="text-xs text-gray-500">Vinculadas</p><p className="text-lg font-black">{metricas.total_vinculadas}</p></div>
            <div className={metricCardClass}>
              <p className="text-xs text-gray-500">Generado</p>
              <p className="text-sm font-black">USD {toMoney(metricas.total_usd_generado)}</p>
              <p className="text-sm font-black text-gray-700 dark:text-gray-200">Bs {toMoney(metricas.total_bs_generado)}</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-xs text-gray-500">Pagado</p>
              <p className="text-sm font-black text-emerald-600">USD {toMoney(metricas.total_usd_pagado)}</p>
              <p className="text-sm font-black text-emerald-600">Bs {toMoney(metricas.total_bs_pagado)}</p>
            </div>
            <div className={metricCardClass}>
              <p className="text-xs text-gray-500">Pendiente</p>
              <p className="text-sm font-black text-red-600">USD {toMoney(metricas.total_usd_pendiente)}</p>
              <p className="text-sm font-black text-red-600">Bs {toMoney(metricas.total_bs_pendiente)}</p>
            </div>
            <div className={metricCardClass}><p className="text-xs text-gray-500">Morosidad Global</p><p className="text-lg font-black">{metricas.porcentaje_morosidad_global.toFixed(2)}%</p></div>
          </div>
        )}
      </article>

      <article ref={conciliacionSectionRef} className={panelClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white">Notificaciones internas</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Seguimiento de cambios, invitaciones y vinculaciones.</p>
          </div>
          <button
            type="button"
            onClick={() => { void handleMarcarTodasLeidas(); }}
            disabled={saving || notificaciones.every((n) => n.leida)}
            className="h-9 rounded-xl border border-gray-300 bg-white px-3 text-xs font-black text-gray-700 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            Marcar todas leídas
          </button>
        </div>

        {notificacionesLoading ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Cargando notificaciones...</p>
        ) : (
          <div className="mt-3 space-y-2">
            {notificaciones.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay notificaciones por ahora.</p>
            ) : (
              notificaciones.slice(0, 12).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border px-3 py-2 ${
                    n.leida
                      ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/70'
                      : 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{n.titulo || 'Notificación'}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{n.mensaje || '-'}</p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {n.created_at ? new Date(n.created_at).toLocaleString('es-VE') : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {n.leida ? (
                        <StatusBadge color="gray" border>Leída</StatusBadge>
                      ) : (
                        <>
                          <StatusBadge color="blue" border>Nueva</StatusBadge>
                          <button
                            type="button"
                            onClick={() => { void handleMarcarNotificacionLeida(n.id); }}
                            disabled={workingId === n.id}
                            className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[11px] font-black text-blue-700 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            Marcar leída
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </article>

      <article className={panelClass}>
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Auditoría de acciones</h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Historial de eventos críticos en la vinculación de juntas.
        </p>
        <div className="mt-4">
          <DataTable<JuntaGeneralAuditoriaRow>
            loading={auditoriaLoading}
            data={auditoriaRows}
            emptyMessage="No hay eventos de auditoría todavía."
            keyExtractor={(row) => row.id}
            columns={[
              { key: 'fecha', header: 'Fecha', render: (row) => row.created_at ? new Date(row.created_at).toLocaleString('es-VE') : '-' },
              { key: 'accion', header: 'Acción', render: (row) => humanizeAuditoriaAccion(row.accion) },
              {
                key: 'actor',
                header: 'Actor',
                render: (row) => {
                  const actor = String(row.actor_nombre || '').trim();
                  const actorJunta = String(row.actor_condominio_nombre || '').trim();
                  if (actor && actorJunta) return `${actor} · ${actorJunta}`;
                  return actor || actorJunta || '-';
                },
              },
              {
                key: 'detalle',
                header: 'Detalle',
                render: (row) => {
                  const detalle = row.detalle_jsonb || null;
                  if (!detalle || typeof detalle !== 'object') return '-';
                  const nombre = String(detalle['nombre'] || detalle['nombre_referencia'] || '').trim();
                  const rifDetalle = String(detalle['rif'] || '').trim();
                  if (nombre && rifDetalle) return `${nombre} (${rifDetalle})`;
                  if (nombre) return nombre;
                  if (rifDetalle) return rifDetalle;
                  return '-';
                },
              },
            ]}
          />
        </div>
      </article>

      <article className={panelClass} data-testid="registrar-junta-individual-card">
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Registrar Junta Individual</h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Si la junta ya existe en Habioo, se vincula automáticamente por RIF.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="md:col-span-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Nombre de la junta
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Torre Norte"
                data-testid="jg-input-nombre"
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            RIF
              <input
                value={rif}
                onChange={(e) => setRif(normalizeJuntaRif(e.target.value))}
                placeholder="J123456789"
                data-testid="jg-input-rif"
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Alícuota (%)
              <input
                value={cuota}
                onChange={(e) => setCuota(formatAlicuotaInput(e.target.value))}
                placeholder="20,5"
                data-testid="jg-input-alicuota"
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-right text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Zona (opcional)
              <select
                value={zonaId}
                onChange={(e) => setZonaId(e.target.value)}
                data-testid="jg-select-zona"
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
              <option value="">Sin zona</option>
              {zonas.filter((z) => z.activa !== false).map((z) => (
                <option key={`zona-create-${z.id}`} value={String(z.id)}>{z.nombre}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => { void handleCrear(); }}
                data-testid="jg-btn-agregar"
                className="h-11 w-full rounded-xl bg-donezo-primary px-4 font-black text-white disabled:opacity-60"
              >
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </article>

      <article className={panelClass} data-testid="estado-cuenta-junta-card">
        <h4 className="text-lg font-black text-gray-900 dark:text-white">Estado de Cuenta por Junta</h4>
        <DataTable
          tableStyle={{ minWidth: '1140px' }}
          data={resumen}
          keyExtractor={(row) => row.miembro_id}
          columns={[
            { key: 'junta', header: 'Junta Individual', className: 'font-semibold', render: (row) => row.nombre_junta_individual },
            { key: 'rif', header: 'RIF', className: 'font-mono', render: (row) => row.rif || '-' },
            { key: 'estado', header: 'Estado Cuenta', render: (row) => estadoCuentaBadge(row.estado_cuenta) },
            { key: 'generado', header: 'Generado USD', headerClassName: 'text-right', className: 'text-right', render: (row) => toMoney(row.saldo_usd_generado) },
            { key: 'generado_bs', header: 'Generado Bs', headerClassName: 'text-right', className: 'text-right', render: (row) => toMoney(row.saldo_bs_generado) },
            { key: 'pagado', header: 'Pagado USD', headerClassName: 'text-right', className: 'text-right text-emerald-600', render: (row) => toMoney(row.saldo_usd_pagado) },
            { key: 'pagado_bs', header: 'Pagado Bs', headerClassName: 'text-right', className: 'text-right text-emerald-600', render: (row) => toMoney(row.saldo_bs_pagado) },
            { key: 'pendiente', header: 'Pendiente USD', headerClassName: 'text-right', className: 'text-right text-red-600', render: (row) => toMoney(row.saldo_usd_pendiente) },
            { key: 'pendiente_bs', header: 'Pendiente Bs', headerClassName: 'text-right', className: 'text-right text-red-600', render: (row) => toMoney(row.saldo_bs_pendiente) },
            { key: 'morosidad', header: '% Morosidad', headerClassName: 'text-right', className: 'text-right', render: (row) => `${row.porcentaje_morosidad.toFixed(2)}%` },
          ]}
        />
      </article>

      <article className={panelClass} data-testid="conciliacion-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white">Conciliación por Período</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Seguimiento por gasto de origen Junta General y su estado de pago en cada junta individual.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <DatePicker
              selected={filtroMesConciliacionDate}
              onChange={(date) => setFiltroMesConciliacion(date ? toYm(date) : '')}
              placeholderText="Filtrar por período"
              inputTestId="jg-filter-mes"
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              wrapperClassName="w-full"
            />
            <SearchableCombobox
              options={opcionesJuntasConciliacion}
              value={filtroMiembroConciliacion}
              onChange={setFiltroMiembroConciliacion}
              placeholder="Buscar junta..."
              buttonTestId="jg-filter-junta"
              searchInputTestId="jg-filter-junta-search"
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              emptyMessage="Sin juntas encontradas"
            />
            <select
              value={filtroEstadoConciliacion}
              onChange={(e) => setFiltroEstadoConciliacion(e.target.value)}
              data-testid="jg-filter-estado"
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Todos los estados</option>
              <option value="CONCILIADO">Conciliado</option>
              <option value="ABONADO">Abonado</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="PENDIENTE_VINCULACION">Pendiente vinculación</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setFiltroMesConciliacion('');
                setFiltroMiembroConciliacion('');
                setFiltroEstadoConciliacion('');
              }}
              data-testid="jg-btn-limpiar-conciliacion"
              className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-xs font-black text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Limpiar
            </button>
          </div>
        </div>

        {conciliacionMetricas && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500">Registros</p>
              <p className="text-lg font-black">{conciliacionMetricas.total_registros}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500">Monto</p>
              <p className="text-sm font-black">USD {toMoney(conciliacionMetricas.total_monto_usd)}</p>
              <p className="text-sm font-black text-gray-700 dark:text-gray-200">Bs {toMoney(conciliacionMetricas.total_monto_bs)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500">Pagado</p>
              <p className="text-sm font-black text-emerald-600">USD {toMoney(conciliacionMetricas.total_pagado_usd)}</p>
              <p className="text-sm font-black text-emerald-600">Bs {toMoney(conciliacionMetricas.total_pagado_bs)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-xs text-gray-500">Pendiente</p>
              <p className="text-sm font-black text-red-600">USD {toMoney(conciliacionMetricas.total_pendiente_usd)}</p>
              <p className="text-sm font-black text-red-600">Bs {toMoney(conciliacionMetricas.total_pendiente_bs)}</p>
            </div>
          </div>
        )}

        {loadingConciliacion ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Cargando conciliación...</p>
        ) : (
          <div className="mt-4">
            {conciliacionError ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                {conciliacionError}
              </div>
            ) : null}
            <DataTable
              tableStyle={{ minWidth: '1320px' }}
              data={conciliacionRows}
              keyExtractor={(row) => `${row.detalle_id}`}
              columns={[
                { key: 'periodo', header: 'Período', className: 'font-semibold', render: (row) => row.mes_origen || '-' },
                { key: 'junta', header: 'Junta', className: 'font-semibold', render: (row) => row.junta_nombre || '-' },
                { key: 'rif', header: 'RIF', className: 'font-mono', render: (row) => row.rif || '-' },
                { key: 'concepto', header: 'Concepto', className: 'text-gray-700 dark:text-gray-300', render: (row) => row.concepto || 'Gasto automático Junta General' },
                { key: 'monto_usd', header: 'Monto USD', headerClassName: 'text-right', className: 'text-right', render: (row) => toMoney(row.monto_usd) },
                { key: 'monto_bs', header: 'Monto Bs', headerClassName: 'text-right', className: 'text-right', render: (row) => toMoney(row.monto_bs) },
                { key: 'pagado_usd', header: 'Pagado USD', headerClassName: 'text-right', className: 'text-right text-emerald-600', render: (row) => toMoney(row.pagado_usd) },
                { key: 'pagado_bs', header: 'Pagado Bs', headerClassName: 'text-right', className: 'text-right text-emerald-600', render: (row) => toMoney(row.pagado_bs) },
                { key: 'pendiente_usd', header: 'Pendiente USD', headerClassName: 'text-right', className: 'text-right text-red-600', render: (row) => toMoney(row.pendiente_usd) },
                { key: 'pendiente_bs', header: 'Pendiente Bs', headerClassName: 'text-right', className: 'text-right text-red-600', render: (row) => toMoney(row.pendiente_bs) },
                { key: 'estado', header: 'Conciliación', render: (row) => estadoConciliacionBadge(row.estado_conciliacion) },
              ]}
            />
          </div>
        )}
      </article>

      <article className={panelClass} data-testid="vinculacion-juntas-card">
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
              data-testid="jg-filter-vinculacion-busqueda"
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as 'TODOS' | EstadoMiembro)}
              data-testid="jg-filter-vinculacion-estado"
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
              { key: 'zona', header: 'Zona', render: (row) => row.zona_nombre || 'Sin zona' },
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
                  const hasHistory = Boolean(row.has_historial_avisos);
                  return (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(row)}
                        disabled={isBusy || hasHistory}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        Editar
                      </button>
                      {hasHistory && (
                        <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Bloqueada por historial
                        </span>
                      )}
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
                            disabled={isBusy || hasHistory}
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
            <label className="md:col-span-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
              Nombre
              <input
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
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
            <label className="md:col-span-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              Zona
              <select
                value={editZonaId}
                onChange={(e) => setEditZonaId(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Sin zona</option>
                {zonas.filter((z) => z.activa !== false).map((z) => (
                  <option key={`zona-edit-${z.id}`} value={String(z.id)}>{z.nombre}</option>
                ))}
              </select>
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



