import { useState, useEffect, useRef } from 'react';
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
  correo: string;
  telefono: string;
  isValid: boolean;
  errors: string;
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

const toNumber = (value: string | number | undefined | null): number => parseFloat(String(value ?? 0)) || 0;

const Propiedades: FC<PropiedadesProps> = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const { showConfirm } = useDialog() as DialogContextType;
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 13;

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
  const [loteErrors, setLoteErrors] = useState<number>(0);
  const [isUploadingLote, setIsUploadingLote] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  void fileInputRef;

  const initialForm: FormState = {
    identificador: '', alicuota: '', prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '',
    tiene_inquilino: false, inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: '',
    inq_permitir_acceso: true,
    monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO', saldo_inicial_bs: '', tasa_bcv: ''
  };

  const [form, setForm] = useState<FormState>(initialForm);

  const fetchPropiedades = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } });
      const data: ApiPropiedadesResponse = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchPropiedades(); }, [userRole]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

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
      identificador: prop.identificador, alicuota: formatAlicuotaDisplay(prop.alicuota),
      prop_nombre: prop.prop_nombre || '', prop_cedula: prop.prop_cedula || '', prop_email: prop.prop_email || '', prop_telefono: prop.prop_telefono || '', prop_password: '',
      tiene_inquilino: !!prop.inq_cedula, inq_nombre: prop.inq_nombre || '', inq_cedula: prop.inq_cedula || '', inq_email: prop.inq_email || '', inq_telefono: prop.inq_telefono || '', inq_password: '',
      inq_permitir_acceso: prop.inq_acceso_portal !== false,
      monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO', saldo_inicial_bs: '', tasa_bcv: ''
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = (): void => { setEditingId(null); setForm(initialForm); setIsModalOpen(true); };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const alicuotaNum = parseFloat(form.alicuota.toString().replace(',', '.'));
    if (isNaN(alicuotaNum) || alicuotaNum <= 0 || alicuotaNum > 100) return alert('⚠️ Error: La alícuota debe ser un porcentaje mayor a 0 y máximo 100.');
    if (!isValidCedulaRif(form.prop_cedula)) return alert('Error: la cédula del propietario debe iniciar con V, E, J o G y contener solo números.');
    if (form.prop_email && !isValidEmail(form.prop_email)) return alert('Error: el correo del propietario no tiene un formato válido.');
    if (form.prop_telefono && !isValidPhone(form.prop_telefono)) return alert('Error: el teléfono del propietario debe tener solo números.');
    if (form.tiene_inquilino) {
      if (!isValidCedulaRif(form.inq_cedula)) return alert('Error: la cédula del inquilino debe iniciar con V, E, J o G y contener solo números.');
      if (form.inq_email && !isValidEmail(form.inq_email)) return alert('Error: el correo del inquilino no tiene un formato válido.');
      if (form.inq_telefono && !isValidPhone(form.inq_telefono)) return alert('Error: el teléfono del inquilino debe tener solo números.');
    }

    const token = localStorage.getItem('habioo_token');
    const url = editingId ? `${API_BASE_URL}/propiedades-admin/${editingId}` : `${API_BASE_URL}/propiedades-admin`;

    const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
    const data: ApiActionResponse = await res.json();
    if (data.status === 'success') { setIsModalOpen(false); fetchPropiedades(); }
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

  // ==========================================
  // FUNCIONES DE LA CARGA MASIVA DE EXCEL
  // ==========================================
  const handleDownloadTemplate = (): void => {
    const data = [
      { Apto: '1A', Nombre: 'Juan Perez', Cedula: 'V12345678', Alicuota: '2.555', SaldoInicial: '50.00', Correo: 'juan@gmail.com', Telefono: '04141234567' },
      { Apto: '1B', Nombre: 'Maria Lopez', Cedula: 'E87654321', Alicuota: '2.5', SaldoInicial: '-20.50', Correo: '', Telefono: '' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);

    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ['NOTAS DEL DEMO', ''],
        ['Cedula:', 'La letra inicial (V, E, J, G, P) debe ir en MAYUSCULA.'],
        ['Alicuota:', 'Use maximo 3 decimales (ej: 2.555 o 2,555).'],
        ['Alicuota en 0:', 'Si todas quedan en 0, el sistema divide gastos por partes iguales entre todos los inmuebles.'],
        ['SaldoInicial:', '0 = sin saldo, positivo = deuda, negativo = saldo a favor.'],
      ],
      { origin: 'I1' }
    );

    ws['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 3 }, { wch: 16 }, { wch: 85 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'Plantilla_Habioo_Inmuebles.xlsx');
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

      let errCount = 0;
      const seenEmails = new Set<string>();

      const parsedData: LoteDataRow[] = rawData.map((row: Record<string, unknown>, index: number) => {
        const apto = row.Apto || row.Identificador || row.Apartamento || row.Casa || '';
        const nombre = row.Nombre || row.Propietario || '';
        const cedulaRaw = row.Cedula || row.Cédula || '';
        const alicuota = row.Alicuota || row.Alícuota || '';
        const saldo = row.SaldoInicial || row['Saldo Inicial'] || row.Saldo || '0';
        const correo = String(row.Correo || row.Email || '').trim().toLowerCase();
        const telefono = row.Telefono || row.Teléfono || '';

        const cedulaFmt = sanitizeCedulaRif(String(cedulaRaw));
        const telefonoFmt = sanitizePhone(String(telefono));
        const emailFmt = sanitizeEmail(correo);
        let aliNum = parseFloat(String(alicuota).replace(',', '.'));
        const isAliValid = !isNaN(aliNum) && aliNum > 0 && aliNum <= 100;

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
          correo: emailFmt,
          telefono: telefonoFmt,
          isValid: errorMsg.length === 0,
          errors: errorMsg.join(' | ')
        };
      });

      setLoteData(parsedData);
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
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inmuebles: loteData })
      });

      clearInterval(progressInterval);
      const data: ApiActionResponse = await res.json();

      if (data.status === 'success') {
        setUploadProgress(100);

        setTimeout(() => {
          alert(data.message);
          setLoteModalOpen(false);
          setLoteData([]);
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
  const totalPages = Math.ceil(filteredProps.length / itemsPerPage);
  const currentProps = filteredProps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const setFormForModal: Dispatch<SetStateAction<PropiedadFormData>> = (value) => {
    setForm((prev: FormState) => {
      const modalPrev: PropiedadFormData = {
        identificador: prev.identificador,
        alicuota: prev.alicuota,
        saldo_inicial_bs: prev.saldo_inicial_bs,
        tasa_bcv: prev.tasa_bcv,
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
        inq_permitir_acceso: prev.inq_permitir_acceso,
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
                    <th className="py-4 pr-3">Inmueble</th>
                    <th className="py-4 px-3 text-right">Alícuota</th>
                    <th className="py-4 px-3 text-right">Saldo Actual</th>
                    <th className="py-4 px-3">Propietario</th>
                    <th className="py-4 pl-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProps.map((p: Propiedad) => {
                    const saldo = toNumber(p.saldo_actual);
                    const isDeuda = saldo > 0;
                    const isFavor = saldo < 0;
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
                        <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-fadeIn">

                          <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                            ✏️ Editar Datos
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
