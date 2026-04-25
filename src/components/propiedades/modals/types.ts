import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';

export interface PropiedadFormData {
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
  prop_email_secundario: string;
  prop_telefono: string;
  prop_telefono_secundario: string;
  prop_password: string;
  tiene_inquilino: boolean;
  inq_cedula: string;
  inq_nombre: string;
  inq_email: string;
  inq_telefono: string;
  inq_permitir_acceso?: boolean;
  tiene_deuda_inicial?: boolean;
  deudas_iniciales?: Array<{
    concepto: string;
    monto_deuda: string;
    monto_abono: string;
  }>;
}

export interface ModalPropiedadFormProps {
  isOpen: boolean;
  editingId: string | number | null;
  form: PropiedadFormData;
  setForm: Dispatch<SetStateAction<PropiedadFormData>>;
  propietariosExistentes: PropietarioExistente[];
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
}

export interface PropietarioExistente {
  id: number;
  cedula: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
}

export interface EstadoCuentaPropiedad {
  identificador: string;
  prop_nombre: string;
  inq_nombre?: string;
  [key: string]: unknown;
}

export interface EstadoCuentaMovimiento {
  fecha_operacion: string;
  fecha_registro: string;
  tipo: string;
  concepto: string;
  monto_bs: number;
  tasa_cambio: number;
  cargo: number;
  abono: number;
  saldoFila: number;
  ref_id?: number;
}

export interface ModalEstadoCuentaProps {
  isOpen: boolean;
  selectedPropCuenta: EstadoCuentaPropiedad | null;
  setEstadoCuentaModalOpen: Dispatch<SetStateAction<boolean>>;
  selectedPropAjuste: unknown;
  fechaDesde: string;
  setFechaDesde: Dispatch<SetStateAction<string>>;
  fechaHasta: string;
  setFechaHasta: Dispatch<SetStateAction<string>>;
  handleOpenAjuste: (propiedad: EstadoCuentaPropiedad) => void | Promise<void>;
  onRevertirAjuste?: (historialId: number) => void;
  loadingCuenta: boolean;
  estadoCuentaFiltrado: EstadoCuentaMovimiento[];
  showAjuste?: boolean;
}

export interface AjusteSaldoFormData {
  tipo_ajuste: 'DEUDA' | 'FAVOR';
  monto: string;
  monto_bs?: string;
  tasa_cambio?: string;
  nota: string;
  subtipo_favor?: 'directo' | 'distribuido';
}

export interface PropiedadAjuste {
  identificador: string;
  [key: string]: unknown;
}

export interface ModalAjusteSaldoProps {
  isOpen: boolean;
  selectedPropAjuste: PropiedadAjuste | null;
  setAjusteModalOpen: Dispatch<SetStateAction<boolean>>;
  formAjuste: AjusteSaldoFormData;
  setFormAjuste: Dispatch<SetStateAction<AjusteSaldoFormData>>;
  handleSubmitAjuste: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export interface LotePropiedadRow {
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

export interface ModalCargaMasivaProps {
  isOpen: boolean;
  setLoteModalOpen: Dispatch<SetStateAction<boolean>>;
  loteData: LotePropiedadRow[];
  setLoteData: Dispatch<SetStateAction<LotePropiedadRow[]>>;
  loteErrors: number;
  montoTotalIngresoLote: number;
  isUploadingLote: boolean;
  uploadProgress: number;
  handleDownloadTemplate: () => void | Promise<void>;
  handleSaveLote: () => void | Promise<void>;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
}

export interface CopropietarioFormData {
  cedula: string;
  nombre: string;
  email: string;
  telefono: string;
  acceso_portal: boolean;
}

export interface CopropietarioItem extends CopropietarioFormData {
  id: number;
  user_id: number;
  propiedad_id: number;
  rol: string;
}

export interface ModalCopropietarioFormProps {
  isOpen: boolean;
  propiedadIdentificador: string;
  form: CopropietarioFormData;
  copropietarios: CopropietarioItem[];
  copropietariosDraft: Record<number, CopropietarioFormData>;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEditChange: (copropId: number, e: ChangeEvent<HTMLInputElement>) => void;
  onSaveEdit: (copropId: number) => void | Promise<void>;
  onDelete: (copropId: number) => void | Promise<void>;
  isSubmitting?: boolean;
  isLoadingList?: boolean;
  savingCopropId?: number | null;
  deletingCopropId?: number | null;
}

export interface ResidenteFormData {
  cedula: string;
  nombre: string;
  email: string;
  telefono: string;
  acceso_portal: boolean;
}

export interface ModalResidenteFormProps {
  isOpen: boolean;
  propiedadIdentificador: string;
  form: ResidenteFormData;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDeleteExisting?: () => void | Promise<void>;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  hasExistingResidente?: boolean;
}


