import { useState, useEffect, useRef, useMemo } from 'react';
import type { FC, ChangeEvent, FormEvent, Dispatch, SetStateAction } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { sanitizeCedulaRif, sanitizePhone, sanitizeEmail, isValidEmail, isValidPhone, isValidCedulaRif } from '../utils/validators';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';
import { ModalAjusteSaldo, ModalEstadoCuenta, ModalPropiedadForm, ModalCargaMasiva } from '../components/propiedades/PropiedadesModals';
import { useDialog } from '../components/ui/DialogProvider';

interface PropiedadesProps {}

interface OutletContextType {
  userRole?: string;
}

interface Propiedad {
  id: number;
  identificador: string;
  alicuota: string | number;
  saldo_actual: string | number;
  prop_nombre: string;
  prop_cedula: string;
  prop_email?: string;
  prop_telefono?: string;
  inq_nombre?: string;
  inq_cedula?: string;
  inq_email?: string;
  inq_telefono?: string;
  inq_acceso_portal?: boolean;
  can_delete?: boolean;
  [key: string]: unknown;
}

interface EstadoCuentaMovimientoRaw {
  fecha_operacion: string;
  fecha_registro: string;
  tipo: string;
  concepto: string;
  monto_bs: string | number;
  tasa_cambio: string | number;
  cargo: string | number;
  abono: string | number;
}

interface EstadoCuentaMovimientoConSaldo {
  fecha_operacion: string;
  fecha_registro: string;
  tipo: string;
  concepto: string;
  monto_bs: number;
  tasa_cambio: number;
  cargo: number;
  abono: number;
  saldoFila: number;
}

interface FormState {
  identificador: string;
  alicuota: string;
  propietario_modo: 'NUEVO' | 'EXISTENTE';
  propietario_existente_id: string;
  prop_nombre: string;
  prop_cedula: string;
  prop_email: string;
  prop_telefono: string;
  prop_password: string;
  tiene_inquilino: boolean;
  inq_nombre: string;
  inq_cedula: string;
  inq_email: string;
  inq_telefono: string;
  inq_password?: string;
  inq_permitir_acceso: boolean;
  monto_saldo_inicial: string;
  tipo_saldo_inicial?: 'CERO';
  saldo_inicial_bs: string;
  tasa_bcv: string;
  tiene_deuda_inicial?: boolean;
  deudas_iniciales?: DeudaInicialManualForm[];
}

interface DeudaInicialManualForm {
  concepto: string;
  monto_deuda: string;
  monto_abono: string;
}

interface FormAjusteState {
  monto: string;
  tipo_ajuste: string;
  nota: string;
}

interface LoteDataRow {
  rowNum: number;
  identificador: string;
  nombre: string;
  cedula: string;
  alicuota: number | string;
  saldo_inicial: string;
  saldo_inicial_base?: string;
  correo: string;
  telefono: string;
  isValid: boolean;
  errors: string;
}

interface LoteDeudaRow {
  identificador: string;
  concepto: string;
  monto_total: number;
  monto_abonado: number;
  saldo: number | null;
}

interface EstadoCuentaPropiedad {
  id?: number;
  identificador: string;
  prop_nombre: string;
  inq_nombre?: string;
  [key: string]: unknown;
}

interface PropiedadFormData {
  identificador: string;
  alicuota: string;
  propietario_modo: 'NUEVO' | 'EXISTENTE';
  propietario_existente_id: string;
  saldo_inicial_bs?: string;
  tasa_bcv?: string;
  monto_saldo_inicial: string;
  prop_cedula: string;
  prop_nombre: string;
  prop_email: string;
  prop_telefono: string;
  prop_password: string;
  tiene_inquilino: boolean;
  inq_cedula: string;
  inq_nombre: string;
  inq_email: string;
  inq_telefono: string;
  inq_permitir_acceso?: boolean;
  tiene_deuda_inicial?: boolean;
  deudas_iniciales?: DeudaInicialManualForm[];
}

interface AjusteSaldoFormData {
  tipo_ajuste: string;
  monto: string;
  nota: string;
}

interface PropiedadAjuste {
  identificador: string;
  id?: number;
  [key: string]: unknown;
}

interface LotePropiedadRow {
  isValid: boolean;
  errors: string;
  identificador: string;
  nombre: string;
  cedula: string;
  correo: string;
  telefono: string;
  alicuota: number | string;
  saldo_inicial: number | string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'warning';
}

interface DialogContextType {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface ApiPropiedadesResponse {
  status: string;
  propiedades: Propiedad[];
  can_delete_all?: boolean;
  error?: string;
  message?: string;
}

interface ApiEstadoCuentaResponse {
  status: string;
  movimientos: EstadoCuentaMovimientoRaw[];
  error?: string;
  message?: string;
}

interface ApiActionResponse {
  status: string;
  error?: string;
  message?: string;
}

interface PropietarioExistente {
  id: number;
  cedula: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
}

type SortColumn = 'identificador' | 'alicuota' | 'saldo_actual' | 'prop_nombre';
type SortDirection = 'asc' | 'desc';

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;

const Propiedades: FC<PropiedadesProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const { showConfirm } = useDialog() as DialogContextType;
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [canDeleteAll, setCanDeleteAll] = useState<boolean>(false);
  const [propietariosExistentes, setPropietariosExistentes] = useState<PropietarioExistente[]>([]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 13;
  const [sortColumn, setSortColumn] = useState<SortColumn>('identificador');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  const [ajusteModalOpen, setAjusteModalOpen] = useState<boolean>(false);
  const [selectedPropAjuste, setSelectedPropAjuste] = useState<PropiedadAjuste | null>(null);
  const [formAjuste, setFormAjuste] = useState<FormAjusteState>({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });

  const [estadoCuentaModalOpen, setEstadoCuentaModalOpen] = useState<boolean>(false);
  const [selectedPropCuenta, setSelectedPropCuenta] = useState<EstadoCuentaPropiedad | null>(null);
  const [estadoCuentaData, setEstadoCuentaData] = useState<EstadoCuentaMovimientoRaw[]>([]);
  const [loadingCuenta, setLoadingCuenta] = useState<boolean>(false);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // 💡 ESTADOS PARA CARGA MASIVA Y BARRA DE PROGRESO
  const [loteModalOpen, setLoteModalOpen] = useState<boolean>(false);
  const [loteData, setLoteData] = useState<LoteDataRow[]>([]);
  const [loteDeudas, setLoteDeudas] = useState<LoteDeudaRow[]>([]);
  const [loteErrors, setLoteErrors] = useState<number>(0);
  const [isUploadingLote, setIsUploadingLote] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  void fileInputRef;

  const montoTotalIngresoLote = useMemo((): number => {
    if (loteDeudas.length > 0) {
      const saldoNetoById = new Map<string, number>();
      loteDeudas.forEach((item: LoteDeudaRow) => {
        const key = item.identificador.toLowerCase();
        const saldoFila = item.saldo ?? (item.monto_total - item.monto_abonado);
        const prev = saldoNetoById.get(key) ?? 0;
        saldoNetoById.set(key, prev + saldoFila);
      });
      return Array.from(saldoNetoById.values()).reduce((acc: number, value: number) => acc + value, 0);
    }

    return loteData.reduce((acc: number, item: LoteDataRow) => {
      const saldo = parseFloat(String(item.saldo_inicial).replace(',', '.'));
      return acc + (Number.isNaN(saldo) ? 0 : saldo);
    }, 0);
  }, [loteData, loteDeudas]);

  const initialForm: FormState = {
    identificador: '', alicuota: '', propietario_modo: 'NUEVO', propietario_existente_id: '', prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '',
    tiene_inquilino: false, inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: '',
    inq_permitir_acceso: true,
    monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO', saldo_inicial_bs: '', tasa_bcv: '',
    tiene_deuda_inicial: false, deudas_iniciales: [{ concepto: '', monto_deuda: '', monto_abono: '' }]
  };

  const [form, setForm] = useState<FormState>(initialForm);

  const fetchPropietariosExistentes = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/propietarios-existentes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.propietarios)) {
        const list = data.propietarios
          .filter((p: unknown) => typeof p === 'object' && p !== null && typeof (p as { id?: unknown }).id === 'number')
          .map((p: unknown) => {
            const raw = p as Record<string, unknown>;
            return {
              id: Number(raw.id),
              cedula: String(raw.cedula || ''),
              nombre: String(raw.nombre || ''),
              email: raw.email ? String(raw.email) : null,
              telefono: raw.telefono ? String(raw.telefono) : null,
            } as PropietarioExistente;
          });
        setPropietariosExistentes(list);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchPropiedades = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } });
      const data: ApiPropiedadesResponse = await res.json();
      if (data.status === 'success') {
        setPropiedades(data.propiedades);
        setCanDeleteAll(Boolean(data.can_delete_all));
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (userRole === 'Administrador') {
      void fetchPropiedades();
      void fetchPropietariosExistentes();
    }
  }, [userRole]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const toggleSort = (column: SortColumn): void => {
    if (sortColumn === column) {
      setSortDirection((prev: SortDirection) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('asc');
  };

  const sortIndicator = (column: SortColumn): string => {
    if (sortColumn !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const fetchEstadoCuenta = async (propId: number): Promise<void> => {
    setLoadingCuenta(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${propId}/estado-cuenta`, { headers: { Authorization: `Bearer ${token}` } });
      const data: ApiEstadoCuentaResponse = await res.json();
      if (data.status === 'success') setEstadoCuentaData(data.movimientos);
    } catch (error) { console.error(error); }
    finally { setLoadingCuenta(false); }
  };

  const handleOpenEstadoCuenta = (prop: Propiedad): void => {
    setOpenDropdownId(null); setSelectedPropCuenta(prop); setFechaDesde(''); setFechaHasta('');
    fetchEstadoCuenta(prop.id); setEstadoCuentaModalOpen(true);
  };
  void handleOpenEstadoCuenta;

  const handleOpenAjuste = (prop: Propiedad): void => {
    setSelectedPropAjuste(prop); setFormAjuste({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' }); setAjusteModalOpen(true);
  };

  const formatAlicuotaDisplay = (value: string | number): string => {
    if (!value) return '';
    const raw = String(value).replace(',', '.');
    const [entero = '', decimal = ''] = raw.split('.');
    if (!decimal) return entero;
    return `${entero},${decimal.slice(0, 3)}`;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
      const checked = e.target.checked;
      const key = name as keyof FormState;
      setForm((prev) => ({ ...prev, [key]: checked as FormState[typeof key] }));
      return;
    }
    if (name === 'prop_cedula' || name === 'inq_cedula') {
      const key = name as 'prop_cedula' | 'inq_cedula';
      setForm((prev) => ({ ...prev, [key]: sanitizeCedulaRif(value) }));
      return;
    }
    if (name === 'prop_telefono' || name === 'inq_telefono') {
      const key = name as 'prop_telefono' | 'inq_telefono';
      setForm((prev) => ({ ...prev, [key]: sanitizePhone(value) }));
      return;
    }
    if (name === 'prop_email' || name === 'inq_email') {
      const key = name as 'prop_email' | 'inq_email';
      setForm((prev) => ({ ...prev, [key]: sanitizeEmail(value) }));
      return;
    }
    if (name === 'alicuota' || name === 'monto_saldo_inicial') {
      const allowNegative = name === 'monto_saldo_inicial' && String(value).trim().startsWith('-');
      let rawVal = value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
      if (allowNegative && !rawVal) {
        const key = name as 'alicuota' | 'monto_saldo_inicial';
        setForm((prev) => ({ ...prev, [key]: '-' }));
        return;
      }
      const parts = rawVal.split(',');
      if (parts.length > 2) rawVal = `${parts[0]},${parts.slice(1).join('')}`;
      if (name === 'alicuota') {
        const [entero = '', decimal = ''] = rawVal.split(',');
        rawVal = rawVal.includes(',') ? `${entero},${decimal.slice(0, 3)}` : entero;
      }
      if (allowNegative && rawVal) rawVal = `-${rawVal}`;
      const key = name as 'alicuota' | 'monto_saldo_inicial';
      setForm((prev) => ({ ...prev, [key]: rawVal }));
      return;
    }
    const key = name as keyof FormState;
    setForm((prev) => ({ ...prev, [key]: value as FormState[typeof key] }));
  };

  const handleEdit = (prop: Propiedad): void => {
    setOpenDropdownId(null); setEditingId(prop.id);
    setForm({
      identificador: prop.identificador, alicuota: formatAlicuotaDisplay(prop.alicuota), propietario_modo: 'NUEVO', propietario_existente_id: '',
      prop_nombre: prop.prop_nombre || '', prop_cedula: prop.prop_cedula || '', prop_email: prop.prop_email || '', prop_telefono: prop.prop_telefono || '', prop_password: '',
      tiene_inquilino: !!prop.inq_cedula, inq_nombre: prop.inq_nombre || '', inq_cedula: prop.inq_cedula || '', inq_email: prop.inq_email || '', inq_telefono: prop.inq_telefono || '', inq_password: '',
      inq_permitir_acceso: prop.inq_acceso_portal !== false,
      monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO', saldo_inicial_bs: '', tasa_bcv: '',
      tiene_deuda_inicial: false, deudas_iniciales: [{ concepto: '', monto_deuda: '', monto_abono: '' }]
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = (): void => { setEditingId(null); setForm(initialForm); setIsModalOpen(true); };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const alicuotaNum = parseFloat(form.alicuota.toString().replace(',', '.'));
    const propiedadesComparables = propiedades.filter((p: Propiedad) => {
      if (editingId === null) return true;
      return Number(p.id) !== Number(editingId);
    });
    const restoEnCero = propiedadesComparables.every((p: Propiedad) => toNumber(p.alicuota) === 0);
    const alicuotaValida =
      Number.isFinite(alicuotaNum) &&
      alicuotaNum >= 0 &&
      alicuotaNum <= 100 &&
      (alicuotaNum > 0 || restoEnCero);

    if (!alicuotaValida) {
      if (alicuotaNum === 0 && !restoEnCero) {
        return alert('⚠️ Error: Solo puedes usar alícuota 0 si todos los inmuebles del condominio también están en 0 (partes iguales).');
      }
      return alert('⚠️ Error: La alícuota debe estar entre 0 y 100.');
    }
    const usaPropietarioExistente = !editingId && form.propietario_modo === 'EXISTENTE';
    if (usaPropietarioExistente && !form.propietario_existente_id) {
      return alert('Debe seleccionar un propietario existente.');
    }
    if (!usaPropietarioExistente) {
      if (!isValidCedulaRif(form.prop_cedula)) return alert('Error: la cédula del propietario debe iniciar con V, E, J o G y contener solo números.');
      if (form.prop_email && !isValidEmail(form.prop_email)) return alert('Error: el correo del propietario no tiene un formato válido.');
      if (form.prop_telefono && !isValidPhone(form.prop_telefono)) return alert('Error: el teléfono del propietario debe tener solo números.');
    }
    if (form.tiene_inquilino) {
      if (!isValidCedulaRif(form.inq_cedula)) return alert('Error: la cédula del residente debe iniciar con V, E, J o G y contener solo números.');
      if (form.inq_email && !isValidEmail(form.inq_email)) return alert('Error: el correo del residente no tiene un formato válido.');
      if (form.inq_telefono && !isValidPhone(form.inq_telefono)) return alert('Error: el teléfono del residente debe tener solo números.');
    }

    const token = localStorage.getItem('habioo_token');
    const url = editingId ? `${API_BASE_URL}/propiedades-admin/${editingId}` : `${API_BASE_URL}/propiedades-admin`;

    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    const data: ApiActionResponse = await res.json();
    if (data.status === 'success') { setIsModalOpen(false); void fetchPropiedades(); void fetchPropietariosExistentes(); }
    else { alert(data.error || data.message); }
  };

  const handleSubmitAjuste = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!selectedPropAjuste?.id) return;
    const ok = await showConfirm({
      title: 'Registrar ajuste',
      message: `¿Registrar ajuste para ${selectedPropAjuste.identificador}?`,
      confirmText: 'Registrar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;
    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`${API_BASE_URL}/propiedades-admin/${selectedPropAjuste.id}/ajustar-saldo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(formAjuste)
    });
    const data: ApiActionResponse = await res.json();
    if (data.status === 'success') {
      alert(data.message); setAjusteModalOpen(false); fetchPropiedades();
      if (selectedPropCuenta?.id === selectedPropAjuste.id) fetchEstadoCuenta(selectedPropCuenta.id);
    } else { alert(data.error); }
  };

  const handleEliminarTodos = async (): Promise<void> => {
    if (!canDeleteAll) {
      alert('No se puede eliminar inmuebles porque ya existen gastos cargados en el sistema.');
      return;
    }

    const ok = await showConfirm({
      title: 'Eliminar todos los inmuebles',
      message: 'Esta acción eliminará todos los inmuebles del condominio y sus datos asociados. ¿Desea continuar?',
      confirmText: 'Eliminar todo',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/eliminar-todos`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiActionResponse = await res.json();
      if (data.status === 'success') {
        alert(data.message || 'Inmuebles eliminados.');
        fetchPropiedades();
      } else {
        alert(data.error || 'No fue posible eliminar los inmuebles.');
      }
    } catch {
      alert('Error de conexión al eliminar inmuebles.');
    }
  };

  const handleEliminarInmueble = async (prop: Propiedad): Promise<void> => {
    if (!prop.can_delete) {
      alert('No se puede eliminar este inmueble porque ya tiene avisos/recibos generados.');
      return;
    }

    const ok = await showConfirm({
      title: 'Eliminar inmueble',
      message: `¿Eliminar el inmueble ${prop.identificador}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${prop.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiActionResponse = await res.json();
      if (data.status === 'success') {
        alert(data.message || 'Inmueble eliminado.');
        setOpenDropdownId(null);
        fetchPropiedades();
      } else {
        alert(data.error || 'No fue posible eliminar el inmueble.');
      }
    } catch {
      alert('Error de conexión al eliminar inmueble.');
    }
  };

  // ==========================================
  // FUNCIONES DE LA CARGA MASIVA DE EXCEL
  // ==========================================
  const handleDownloadTemplate = (): void => {
    const dataPropiedades = [
      {
        'Nro Apartamento': 'A-1',
        'Propietario': 'Juan Pérez',
        'Cédula': 'V12345678',
        'Email': 'juan.perez@email.com',
        'Teléfono': '04141234567',
        'Alícuota': 0
      },
      {
        'Nro Apartamento': 'A-2',
        'Propietario': 'María López',
        'Cédula': 'V87654321',
        'Email': 'maria.lopez@email.com',
        'Teléfono': '04145556677',
        'Alícuota': 0
      },
      {
        'Nro Apartamento': 'A-3',
        'Propietario': 'Carlos Gómez',
        'Cédula': 'V11223344',
        'Email': 'carlos.gomez@email.com',
        'Teléfono': '04143332211',
        'Alícuota': 0
      },
      {
        'Nro Apartamento': 'A-4',
        'Propietario': 'Ana Ruiz',
        'Cédula': 'V55667788',
        'Email': 'ana.ruiz@email.com',
        'Teléfono': '04147778899',
        'Alícuota': 0
      }
    ];

    const dataEstadoCuenta = [
      {
        'Nro Apartamento': 'A-1',
        'Concepto': 'Gasto antiguo mantenimiento',
        'Monto Deuda': 60.0,
        'Monto Abono': 30.0,
        'Saldo': 30.0
      },
      {
        'Nro Apartamento': 'A-2',
        'Concepto': 'Gasto antiguo ascensor',
        'Monto Deuda': 80.0,
        'Monto Abono': 0.0,
        'Saldo': 80.0
      },
      {
        'Nro Apartamento': 'A-3',
        'Concepto': '',
        'Monto Deuda': 0.0,
        'Monto Abono': 30.0,
        'Saldo': -30.0
      },
      {
        'Nro Apartamento': 'A-4',
        'Concepto': '',
        'Monto Deuda': 0.0,
        'Monto Abono': 0.0,
        'Saldo': 0.0
      }
    ];

    const wb = XLSX.utils.book_new();
    const setCellTextStyle = (ws: XLSX.WorkSheet, cellRef: string): void => {
      const cell = ws[cellRef];
      if (!cell) return;
      (cell as XLSX.CellObject & {
        s?: {
          fill?: { fgColor?: { rgb?: string } };
          font?: { bold?: boolean; color?: { rgb?: string } };
          alignment?: { vertical?: string; wrapText?: boolean };
        };
      }).s = {
        fill: { fgColor: { rgb: 'FFF7D6' } },
        font: { bold: true, color: { rgb: '7A5A00' } },
        alignment: { vertical: 'top', wrapText: true }
      };
    };
    const setSaldoCellStyle = (ws: XLSX.WorkSheet, cellRef: string): void => {
      const cell = ws[cellRef];
      if (!cell) return;
      (cell as XLSX.CellObject & {
        s?: {
          fill?: { fgColor?: { rgb?: string } };
          font?: { bold?: boolean; color?: { rgb?: string } };
          alignment?: { vertical?: string };
        };
      }).s = {
        fill: { fgColor: { rgb: 'E8F5E9' } },
        font: { bold: true, color: { rgb: '1B5E20' } },
        alignment: { vertical: 'center' }
      };
    };

        const wsPropiedades = XLSX.utils.json_to_sheet(dataPropiedades);
    const guiaPropiedades: string[][] = [
      ['Guía de llenado'],
      ['Paso 1 (A): Nro Apartamento único (ej: A-1).'],
      ['Paso 2 (B): Nombre del Propietario.'],
      ['Paso 3 (C): Cédula con formato V/E/J/G/P + números.'],
      ['Paso 4 (D): Email (opcional).'],
      ['Paso 5 (E): Teléfono de 7 a 15 dígitos.'],
      ['Paso 6 (F): Alícuota: todas en 0 o todas > 0 (no mezclar).']
    ];
    XLSX.utils.sheet_add_aoa(wsPropiedades, guiaPropiedades, { origin: 'H1' });
    guiaPropiedades.forEach((_, index) => setCellTextStyle(wsPropiedades, `H${index + 1}`));
    wsPropiedades['!cols'] = [
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 10 },
      { wch: 3 },
      { wch: 90 }
    ];

    const wsDeudas = XLSX.utils.json_to_sheet(dataEstadoCuenta);
    for (let row = 2; row <= 500; row += 1) {
      wsDeudas[`E${row}`] = { t: 'n', f: `C${row}-D${row}` };
      setSaldoCellStyle(wsDeudas, `E${row}`);
    }
    const guiaDeudas: string[][] = [
      ['Guía de llenado'],
      ['Paso 1 (A): Nro Apartamento igual al de la hoja Propiedades.'],
      ['Paso 2 (B): Concepto del cobro o nota de estado de cuenta.'],
      ['Paso 3 (C): Monto Deuda en USD (si no hay deuda, use 0).'],
      ['Paso 4 (D): Monto Abono en USD (si no hay abono, use 0).'],
      ['Paso 5 (E): Saldo = Monto Deuda - Monto Abono (fórmula automática, no editar).']
    ];
    XLSX.utils.sheet_add_aoa(wsDeudas, guiaDeudas, { origin: 'G1' });
    guiaDeudas.forEach((_, index) => setCellTextStyle(wsDeudas, `G${index + 1}`));
    wsDeudas['!cols'] = [
      { wch: 16 },
      { wch: 36 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 3 },
      { wch: 90 }
    ];

    XLSX.utils.book_append_sheet(wb, wsPropiedades, 'Propiedades');
    XLSX.utils.book_append_sheet(wb, wsDeudas, 'saldos_bases');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Habioo.xlsx');
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const bstr = event.target?.result;
      if (typeof bstr !== 'string') return;

      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      if (wsname === undefined) return;
      const ws = wb.Sheets[wsname];
      if (ws === undefined) return;
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const wsnameDeudas = wb.SheetNames[1];
      const wsDeudas = wsnameDeudas !== undefined ? wb.Sheets[wsnameDeudas] : undefined;
      const rawDeudas = wsDeudas
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wsDeudas, { defval: '' })
        : [];

      const parseAlicuota = (value: unknown): number => {
        const normalized = String(value ?? '').trim().replace(',', '.');
        const parsed = parseFloat(normalized);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const alicuotas: number[] = rawData.map((row: Record<string, unknown>) =>
        parseAlicuota(row.Alicuota ?? row.Alícuota ?? 0)
      );
      const tieneCeros: boolean = alicuotas.some((a: number) => a === 0);
      const tieneMayoresACero: boolean = alicuotas.some((a: number) => a > 0);

      if (tieneCeros && tieneMayoresACero) {
        setLoteData([]);
        setLoteDeudas([]);
        setLoteErrors(0);
        e.target.value = '';
        alert('Error: El archivo tiene alícuotas mixtas. Ingrese todas en 0 (para dividir por partes iguales) o asigne un valor mayor a 0 a todas.');
        return;
      }

      let errCount = 0;
      const seenEmails = new Set<string>();

      const parsedData: LoteDataRow[] = rawData.map((row: Record<string, unknown>, index: number) => {
        const apto =
          row['Nro Apartamento'] ||
          row['Nro. Apartamento'] ||
          row['NroApartamento'] ||
          row.Apto ||
          row['Apto/Casa'] ||
          row.Identificador ||
          row.Apartamento ||
          row.Casa ||
          '';
        const nombre = row.Nombre || row.Propietario || '';
        const cedulaRaw = row.Cedula || row.Cédula || '';
        const alicuota = row.Alicuota || row.Alícuota || '';
        const saldo = row.SaldoInicial || row['Saldo Inicial'] || row.Saldo || '0';
        const correo = String(row.Correo || row.Email || '').trim().toLowerCase();
        const telefono = row.Telefono || row.Teléfono || '';

        const cedulaFmt = sanitizeCedulaRif(String(cedulaRaw));
        const telefonoFmt = sanitizePhone(String(telefono));
        const emailFmt = sanitizeEmail(correo);
        let aliNum = parseAlicuota(alicuota);
        const isAliValid = !Number.isNaN(aliNum) && aliNum >= 0 && aliNum <= 100;

        if (isAliValid) {
          aliNum = parseFloat(aliNum.toFixed(3));
        }

        const errorMsg: string[] = [];
        if (!apto) errorMsg.push('Apto vacío');
        if (!nombre) errorMsg.push('Nombre vacío');
        if (!cedulaFmt) errorMsg.push('Cédula inválida (Use V/E/J/G)');
        if (!isAliValid) errorMsg.push('Alícuota inválida');
        if (emailFmt && !isValidEmail(emailFmt)) errorMsg.push('Correo inválido');
        if (telefonoFmt && !isValidPhone(telefonoFmt)) errorMsg.push('Teléfono inválido');

        if (emailFmt) {
          if (seenEmails.has(emailFmt)) {
            errorMsg.push('Correo duplicado');
          } else {
            seenEmails.add(emailFmt);
          }
        }

        if (errorMsg.length > 0) errCount++;

        return {
          rowNum: index + 2,
          identificador: String(apto).trim(),
          nombre: String(nombre).trim(),
          cedula: cedulaFmt,
          alicuota: isAliValid ? aliNum : String(alicuota),
          saldo_inicial: String(saldo).replace(',', '.'),
          saldo_inicial_base: String(saldo).replace(',', '.'),
          correo: emailFmt,
          telefono: telefonoFmt,
          isValid: errorMsg.length === 0,
          errors: errorMsg.join(' | ')
        };
      });

      const parseMoney = (value: unknown): number => {
        const normalized = String(value ?? '').trim().replace(',', '.');
        const parsed = parseFloat(normalized);
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const parsedDeudas: LoteDeudaRow[] = rawDeudas
        .map((row: Record<string, unknown>) => {
          const montoDeuda = parseMoney(
            row['Monto Deuda'] ??
            row['Monto deuda'] ??
            row['Monto Deuda ($)'] ??
            row['Monto Total ($)'] ??
            row.MontoTotal ??
            row.monto_total
          );
          const montoAbono = parseMoney(
            row['Monto Abono'] ??
            row['Monto abono'] ??
            row['Monto Abonado ($)'] ??
            row.MontoAbonado ??
            row.monto_abonado
          );
          const saldoRaw = String(row.Saldo ?? row['Saldo ($)'] ?? row.saldo ?? '').trim();
          const saldoNum = saldoRaw !== '' ? parseMoney(saldoRaw) : (montoDeuda - montoAbono);
          return {
            identificador: String(
              row['Nro Apartamento'] ||
              row['Nro. Apartamento'] ||
              row['NroApartamento'] ||
              row.Identificador ||
              ''
            ).trim(),
            concepto: String(row.Concepto || '').trim(),
            monto_total: montoDeuda,
            monto_abonado: montoAbono,
            saldo: saldoNum
          };
        })
        .filter((item: LoteDeudaRow) => {
          if (!item.identificador) return false;
          return Boolean(
            item.concepto ||
            item.monto_total > 0 ||
            item.monto_abonado > 0 ||
            item.saldo !== null
          );
        });

      const saldoNetoByIdentificador = new Map<string, number>();

      parsedDeudas.forEach((item: LoteDeudaRow) => {
        const key = item.identificador.toLowerCase();
        if (!key) return;

        const saldoFila = item.saldo ?? (item.monto_total - item.monto_abonado);
        const acumulado = saldoNetoByIdentificador.get(key) ?? 0;
        saldoNetoByIdentificador.set(key, acumulado + saldoFila);
      });

      const parsedDataConSaldo = parsedData.map((row: LoteDataRow) => {
        const key = row.identificador.toLowerCase();
        if (saldoNetoByIdentificador.has(key)) {
          const saldoNeto = saldoNetoByIdentificador.get(key) ?? 0;
          return { ...row, saldo_inicial: String(saldoNeto) };
        }
        return row;
      });

      setLoteData(parsedDataConSaldo);
      setLoteDeudas(parsedDeudas);
      setLoteErrors(errCount);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // 💡 LÓGICA DE GUARDADO MEJORADA CON PROGRESO
  const handleSaveLote = async (): Promise<void> => {
    if (loteErrors > 0) return alert('Por favor corrija los errores en el Excel antes de continuar.');
    const ok = await showConfirm({
      title: 'Guardar carga masiva',
      message: `¿Está seguro de guardar ${loteData.length} inmuebles de golpe?`,
      confirmText: 'Guardar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    setIsUploadingLote(true);
    setUploadProgress(0);

    // Animación de la barra de progreso
    const progressInterval: ReturnType<typeof setInterval> = setInterval(() => {
      setUploadProgress((prev: number) => {
        // La barra llega hasta el 90% esperando a que el servidor termine
        if (prev >= 90) return 90;
        // Calculamos un incremento variable para que se vea más natural
        const increment = Math.random() * 15;
        return prev + increment;
      });
    }, 500); // Se actualiza cada medio segundo

    try {
      const token = localStorage.getItem('habioo_token');
      const propiedadesPayload = loteData.map((item: LoteDataRow) => ({
        identificador: item.identificador,
        alicuota: item.alicuota,
        saldo_inicial: item.saldo_inicial_base ?? item.saldo_inicial,
        nombre: item.nombre,
        cedula: item.cedula,
        correo: item.correo,
        telefono: item.telefono
      }));
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          propiedades: propiedadesPayload,
          deudas: loteDeudas.map((item: LoteDeudaRow) => ({
            identificador: item.identificador,
            concepto: item.concepto,
            monto_total: item.monto_total,
            monto_abonado: item.monto_abonado,
            saldo: item.saldo
          }))
        })
      });

      clearInterval(progressInterval);
      const data: ApiActionResponse = await res.json();

      if (data.status === 'success') {
        setUploadProgress(100);

        setTimeout(() => {
          alert(data.message);
          setLoteModalOpen(false);
          setLoteData([]);
          setLoteDeudas([]);
          fetchPropiedades();
          setIsUploadingLote(false);
          setUploadProgress(0); // Reiniciamos para la próxima
        }, 500);

      } else {
        setIsUploadingLote(false);
        setUploadProgress(0);
        alert('Error del servidor: ' + (data.error || data.message));
      }
    } catch (err) {
      clearInterval(progressInterval);
      setIsUploadingLote(false);
      setUploadProgress(0);
      alert('Error de conexión al cargar lote.');
    }
  };

  // Cálculos y Paginación
  let saldoAcumulado = 0;
  const dataConSaldo: EstadoCuentaMovimientoConSaldo[] = estadoCuentaData.map((mov: EstadoCuentaMovimientoRaw) => {
    const cargo = toNumber(mov.cargo);
    const abono = toNumber(mov.abono);
    saldoAcumulado += cargo - abono;
    return {
      fecha_operacion: String(mov.fecha_operacion || ''),
      fecha_registro: String(mov.fecha_registro || ''),
      tipo: String(mov.tipo || ''),
      concepto: String(mov.concepto || ''),
      monto_bs: toNumber(mov.monto_bs),
      tasa_cambio: toNumber(mov.tasa_cambio),
      cargo,
      abono,
      saldoFila: saldoAcumulado,
    };
  });
  const estadoCuentaFiltrado: EstadoCuentaMovimientoConSaldo[] = dataConSaldo.filter((m: EstadoCuentaMovimientoConSaldo) => {
    if (!fechaDesde && !fechaHasta) return true;
    const f = new Date(m.fecha_registro);
    if (fechaDesde && f < new Date(fechaDesde)) return false;
    if (fechaHasta && f > new Date(fechaHasta)) return false;
    return true;
  });
  const totalCargo = estadoCuentaFiltrado.reduce((acc: number, m: EstadoCuentaMovimientoConSaldo) => acc + toNumber(m.cargo), 0);
  const totalAbono = estadoCuentaFiltrado.reduce((acc: number, m: EstadoCuentaMovimientoConSaldo) => acc + toNumber(m.abono), 0);

  const filteredProps = propiedades.filter((p: Propiedad) => p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) || p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase()));
  const sortedProps = [...filteredProps].sort((a: Propiedad, b: Propiedad) => {
    let cmp = 0;
    if (sortColumn === 'identificador') {
      cmp = String(a.identificador || '').localeCompare(String(b.identificador || ''), 'es', { sensitivity: 'base' });
    } else if (sortColumn === 'prop_nombre') {
      cmp = String(a.prop_nombre || '').localeCompare(String(b.prop_nombre || ''), 'es', { sensitivity: 'base' });
    } else if (sortColumn === 'alicuota') {
      cmp = toNumber(a.alicuota) - toNumber(b.alicuota);
    } else if (sortColumn === 'saldo_actual') {
      cmp = toNumber(a.saldo_actual) - toNumber(b.saldo_actual);
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sortedProps.length / itemsPerPage);
  const currentProps = sortedProps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const setFormForModal: Dispatch<SetStateAction<PropiedadFormData>> = (value) => {
    setForm((prev: FormState) => {
      const modalPrev: PropiedadFormData = {
        identificador: prev.identificador,
        alicuota: prev.alicuota,
        propietario_modo: prev.propietario_modo,
        propietario_existente_id: prev.propietario_existente_id,
        monto_saldo_inicial: prev.monto_saldo_inicial,
        prop_cedula: prev.prop_cedula,
        prop_nombre: prev.prop_nombre,
        prop_email: prev.prop_email,
        prop_telefono: prev.prop_telefono,
        prop_password: prev.prop_password,
        tiene_inquilino: prev.tiene_inquilino,
        inq_cedula: prev.inq_cedula,
        inq_nombre: prev.inq_nombre,
        inq_email: prev.inq_email,
        inq_telefono: prev.inq_telefono,
        ...(prev.saldo_inicial_bs !== undefined ? { saldo_inicial_bs: prev.saldo_inicial_bs } : {}),
        ...(prev.tasa_bcv !== undefined ? { tasa_bcv: prev.tasa_bcv } : {}),
        ...(prev.inq_permitir_acceso !== undefined ? { inq_permitir_acceso: prev.inq_permitir_acceso } : {}),
        ...(prev.tiene_deuda_inicial !== undefined ? { tiene_deuda_inicial: prev.tiene_deuda_inicial } : {}),
        ...(prev.deudas_iniciales !== undefined ? { deudas_iniciales: prev.deudas_iniciales } : {}),
      };
      const next = typeof value === 'function' ? value(modalPrev) : value;
      return { ...prev, ...next };
    });
  };

  const setFormAjusteForModal: Dispatch<SetStateAction<AjusteSaldoFormData>> = (value) => {
    setFormAjuste((prev: FormAjusteState) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return { ...prev, ...next };
    });
  };

  const setLoteDataForModal: Dispatch<SetStateAction<LotePropiedadRow[]>> = (value) => {
    setLoteData((prev: LoteDataRow[]) => {
      const toModalRows = (rows: LoteDataRow[]): LotePropiedadRow[] =>
        rows.map((row: LoteDataRow) => ({
          isValid: row.isValid,
          errors: row.errors,
          identificador: row.identificador,
          nombre: row.nombre,
          cedula: row.cedula,
          correo: row.correo,
          telefono: row.telefono,
          alicuota: row.alicuota,
          saldo_inicial: row.saldo_inicial,
        }));
      const nextRows = typeof value === 'function' ? value(toModalRows(prev)) : value;
      return nextRows.map((row: LotePropiedadRow, index: number) => ({
        rowNum: prev[index]?.rowNum ?? index + 1,
        ...row,
        saldo_inicial: String(row.saldo_inicial),
        saldo_inicial_base: prev[index]?.saldo_inicial_base ?? String(row.saldo_inicial),
      }));
    });
  };

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative" onClick={() => setOpenDropdownId(null)}>
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white whitespace-nowrap">🏠 Inmuebles y Residentes</h3>
        <div className="flex-1 w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input type="text" placeholder="Buscar apartamento o propietario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
        </div>
        <div className="flex gap-3 w-full xl:w-auto">
          {canDeleteAll && propiedades.length > 0 && (
            <button
              onClick={handleEliminarTodos}
              className="flex-1 xl:flex-none bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:border-red-800/50 dark:text-red-400 font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-sm"
            >
              Eliminar todos
            </button>
          )}
          <button onClick={() => setLoteModalOpen(true)} className="flex-1 xl:flex-none bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:border-green-800/50 dark:text-green-400 font-bold py-2.5 px-5 rounded-xl transition-all shadow-sm text-sm flex items-center justify-center gap-2">
            📊 Carga Masiva
          </button>
          
          <button onClick={handleCreateNew} className="flex-1 xl:flex-none bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md text-sm whitespace-nowrap">
            + Agregar Inmueble
          </button>
        </div>
      </div>

      {/* TABLA DE PROPIEDADES */}
      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 p-6">Cargando...</p> : currentProps.length === 0 ? <p className="text-gray-500 text-center py-10">No hay inmuebles registrados.</p> : (
          <>
            <div className="overflow-x-auto pt-2 px-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="py-4 pr-3">
                      <button type="button" onClick={() => toggleSort('identificador')} className="font-bold hover:text-donezo-primary">
                        Inmueble {sortIndicator('identificador')}
                      </button>
                    </th>
                    <th className="py-4 px-3 text-right">
                      <button type="button" onClick={() => toggleSort('alicuota')} className="font-bold hover:text-donezo-primary">
                        Alícuota {sortIndicator('alicuota')}
                      </button>
                    </th>
                    <th className="py-4 px-3 text-right">
                      <button type="button" onClick={() => toggleSort('saldo_actual')} className="font-bold hover:text-donezo-primary">
                        Saldo Actual {sortIndicator('saldo_actual')}
                      </button>
                    </th>
                    <th className="py-4 px-3">
                      <button type="button" onClick={() => toggleSort('prop_nombre')} className="font-bold hover:text-donezo-primary">
                        Propietario {sortIndicator('prop_nombre')}
                      </button>
                    </th>
                    <th className="py-4 pl-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProps.map((p: Propiedad, index: number) => {
                    const saldo = toNumber(p.saldo_actual);
                    const isDeuda = saldo > 0;
                    const isFavor = saldo < 0;
                    const abrirHaciaArriba = index >= currentProps.length - 2;
                    return (
                      <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 pr-3 font-bold text-gray-800 dark:text-white">{p.identificador}</td>
                        <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">{formatAlicuotaDisplay(p.alicuota)}%</td>
                        <td className="py-3 px-3 text-right">
                          <div className={`font-black font-mono tracking-tight ${isDeuda ? 'text-red-500' : isFavor ? 'text-green-500' : 'text-gray-400'}`}>${formatMoney(Math.abs(saldo))}</div>
                          <div className="text-[10px] uppercase font-bold text-gray-400">{isDeuda ? 'Deuda' : isFavor ? 'A Favor' : 'Solvente'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-800 dark:text-gray-300 text-sm">{p.prop_nombre}</div>
                          <div className="text-xs text-gray-500">{p.prop_cedula}</div>
                        </td>
                        <td className="py-3 pl-3 text-center relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === p.id ? null : p.id); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">
                            Opciones <span className="text-[9px]">▼</span>
                          </button>
                          {openDropdownId === p.id && (
                        <div className={`absolute right-0 ${abrirHaciaArriba ? 'bottom-12' : 'top-12'} w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-fadeIn`}>

                          <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                            ✏️ Editar Datos
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleEliminarInmueble(p); }}
                            disabled={!p.can_delete}
                            className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm text-red-600 dark:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={p.can_delete ? 'Eliminar inmueble' : 'No se puede eliminar: ya tiene avisos/recibos'}
                          >
                            🗑️ Eliminar inmueble
                          </button>
                           
                        </div>
                      )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 rounded-b-2xl">
                <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">← Anterior</button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>

      <ModalEstadoCuenta
        isOpen={estadoCuentaModalOpen}
        selectedPropCuenta={selectedPropCuenta}
        setEstadoCuentaModalOpen={setEstadoCuentaModalOpen}
        selectedPropAjuste={selectedPropAjuste}
        fechaDesde={fechaDesde}
        setFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta}
        setFechaHasta={setFechaHasta}
        handleOpenAjuste={(propiedad: EstadoCuentaPropiedad) => handleOpenAjuste(propiedad as Propiedad)}
        loadingCuenta={loadingCuenta}
        estadoCuentaFiltrado={estadoCuentaFiltrado}
      />

      <ModalPropiedadForm
        isOpen={isModalOpen}
        editingId={editingId}
        form={form}
        setForm={setFormForModal}
        propietariosExistentes={propietariosExistentes}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        setIsModalOpen={setIsModalOpen}
      />

      <ModalAjusteSaldo
        isOpen={ajusteModalOpen}
        selectedPropAjuste={selectedPropAjuste}
        setAjusteModalOpen={setAjusteModalOpen}
        formAjuste={formAjuste}
        setFormAjuste={setFormAjusteForModal}
        handleSubmitAjuste={handleSubmitAjuste}
      />

      <ModalCargaMasiva 
        isOpen={loteModalOpen}
        setLoteModalOpen={setLoteModalOpen}
        loteData={loteData}
        setLoteData={setLoteDataForModal}
        loteErrors={loteErrors}
        montoTotalIngresoLote={montoTotalIngresoLote}
        isUploadingLote={isUploadingLote}
        uploadProgress={uploadProgress} 
        handleDownloadTemplate={handleDownloadTemplate}
        handleSaveLote={handleSaveLote}
        handleFileUpload={handleFileUpload}
      />

    </div>
  );
};

export default Propiedades;
