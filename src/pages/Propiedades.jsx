import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { sanitizeCedulaRif, sanitizePhone, sanitizeEmail, isValidEmail, isValidPhone, isValidCedulaRif } from '../utils/validators';
import { API_BASE_URL } from '../config/api';
import * as XLSX from 'xlsx';
import { ModalAjusteSaldo, ModalEstadoCuenta, ModalPropiedadForm, ModalCargaMasiva } from '../components/propiedades/PropiedadesModals';
import { useDialog } from '../components/ui/DialogProvider';

export default function Propiedades() {
  const { userRole } = useOutletContext();
  const { showConfirm } = useDialog();
  const [propiedades, setPropiedades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 13;

  const [editingId, setEditingId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [selectedPropAjuste, setSelectedPropAjuste] = useState(null);
  const [formAjuste, setFormAjuste] = useState({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });

  const [estadoCuentaModalOpen, setEstadoCuentaModalOpen] = useState(false);
  const [selectedPropCuenta, setSelectedPropCuenta] = useState(null);
  const [estadoCuentaData, setEstadoCuentaData] = useState([]);
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // 💡 ESTADOS PARA CARGA MASIVA Y BARRA DE PROGRESO
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [loteData, setLoteData] = useState([]);
  const [loteErrors, setLoteErrors] = useState(0);
  const [isUploadingLote, setIsUploadingLote] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Nuevo estado
  const fileInputRef = useRef(null);

  const initialForm = {
    identificador: '', alicuota: '', prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '',
    tiene_inquilino: false, inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: '',
    inq_permitir_acceso: true,
    monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO', saldo_inicial_bs: '', tasa_bcv: ''
  };

  const [form, setForm] = useState(initialForm);

  const fetchPropiedades = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (userRole === 'Administrador') fetchPropiedades(); }, [userRole]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchEstadoCuenta = async (propId) => {
    setLoadingCuenta(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${propId}/estado-cuenta`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setEstadoCuentaData(data.movimientos);
    } catch (error) { console.error(error); } 
    finally { setLoadingCuenta(false); }
  };

  const handleOpenEstadoCuenta = (prop) => {
    setOpenDropdownId(null); setSelectedPropCuenta(prop); setFechaDesde(''); setFechaHasta('');
    fetchEstadoCuenta(prop.id); setEstadoCuentaModalOpen(true);
  };

  const handleOpenAjuste = (prop) => {
    setSelectedPropAjuste(prop); setFormAjuste({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' }); setAjusteModalOpen(true);
  };

  const formatAlicuotaDisplay = (value) => {
    if (!value) return '';
    const raw = String(value).replace(',', '.');
    const [entero = '', decimal = ''] = raw.split('.');
    if (!decimal) return entero;
    return `${entero},${decimal.slice(0, 3)}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') return setForm({ ...form, [name]: checked });
    if (name === 'prop_cedula' || name === 'inq_cedula') return setForm({ ...form, [name]: sanitizeCedulaRif(value) });
    if (name === 'prop_telefono' || name === 'inq_telefono') return setForm({ ...form, [name]: sanitizePhone(value) });
    if (name === 'prop_email' || name === 'inq_email') return setForm({ ...form, [name]: sanitizeEmail(value) });
    if (name === 'alicuota' || name === 'monto_saldo_inicial') {
      const allowNegative = name === 'monto_saldo_inicial' && String(value).trim().startsWith('-');
      let rawVal = value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
      if (allowNegative && !rawVal) return setForm({ ...form, [name]: '-' });
      const parts = rawVal.split(',');
      if (parts.length > 2) rawVal = `${parts[0]},${parts.slice(1).join('')}`;
      if (name === 'alicuota') {
        const [entero = '', decimal = ''] = rawVal.split(',');
        rawVal = rawVal.includes(',') ? `${entero},${decimal.slice(0, 3)}` : entero;
      }
      if (allowNegative && rawVal) rawVal = `-${rawVal}`;
      return setForm({ ...form, [name]: rawVal });
    }
    setForm({ ...form, [name]: value });
  };

  const handleEdit = (prop) => {
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

  const handleCreateNew = () => { setEditingId(null); setForm(initialForm); setIsModalOpen(true); };

  const handleSubmit = async (e) => {
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
    const data = await res.json();
    if (data.status === 'success') { setIsModalOpen(false); fetchPropiedades(); } 
    else { alert(data.error || data.message); }
  };

  const handleSubmitAjuste = async (e) => {
    e.preventDefault();
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
    const data = await res.json();
    if (data.status === 'success') {
      alert(data.message); setAjusteModalOpen(false); fetchPropiedades();
      if (selectedPropCuenta?.id === selectedPropAjuste.id) fetchEstadoCuenta(selectedPropCuenta.id);
    } else { alert(data.error); }
  };

  // ==========================================
  // FUNCIONES DE LA CARGA MASIVA DE EXCEL
  // ==========================================
  const handleDownloadTemplate = () => {
    const data = [
      { Apto: '1A', Nombre: 'Juan Perez', Cedula: 'V12345678', Alicuota: '2.555', SaldoInicial: '50.00', Correo: 'juan@gmail.com', Telefono: '04141234567' },
      { Apto: '1B', Nombre: 'Maria Lopez', Cedula: 'E87654321', Alicuota: '2.5', SaldoInicial: '-20.50', Correo: '', Telefono: '' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);

    if (ws['C1']) ws['C1'].c = [{ a: 'Sistema', t: '¡IMPORTANTE! La letra de la cédula (V, E, J, G, P) debe ser obligatoriamente en MAYÚSCULA.' }];
    if (ws['D1']) ws['D1'].c = [{ a: 'Sistema', t: 'El porcentaje debe tener máximo 3 decimales (Ejemplo: 2.555 o 2,555).' }];
    if (ws['E1']) ws['E1'].c = [{ a: 'Sistema', t: 'Si no tiene saldo deje en 0. Si le debe al condominio use números positivos (50). Si tiene a favor use número negativo (-50).' }];

    ws['!cols'] = [ {wch: 10}, {wch: 25}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 25}, {wch: 15} ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Habioo_Inmuebles.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      let errCount = 0;
      let seenEmails = new Set(); 

      const parsedData = rawData.map((row, index) => {
        const apto = row['Apto'] || row['Identificador'] || row['Apartamento'] || row['Casa'] || '';
        const nombre = row['Nombre'] || row['Propietario'] || '';
        const cedulaRaw = row['Cedula'] || row['Cédula'] || '';
        const alicuota = row['Alicuota'] || row['Alícuota'] || '';
        const saldo = row['SaldoInicial'] || row['Saldo Inicial'] || row['Saldo'] || '0';
        const correo = String(row['Correo'] || row['Email'] || '').trim().toLowerCase(); 
        const telefono = row['Telefono'] || row['Teléfono'] || '';

        const cedulaFmt = sanitizeCedulaRif(String(cedulaRaw));
        const telefonoFmt = sanitizePhone(String(telefono));
        const emailFmt = sanitizeEmail(correo);
        let aliNum = parseFloat(String(alicuota).replace(',', '.'));
        const isAliValid = !isNaN(aliNum) && aliNum > 0 && aliNum <= 100;

        if (isAliValid) {
           aliNum = parseFloat(aliNum.toFixed(3)); 
        }

        let errorMsg = [];
        if (!apto) errorMsg.push("Apto vacío");
        if (!nombre) errorMsg.push("Nombre vacío");
        if (!cedulaFmt) errorMsg.push("Cédula inválida (Use V/E/J/G)");
        if (!isAliValid) errorMsg.push("Alícuota inválida");
        if (emailFmt && !isValidEmail(emailFmt)) errorMsg.push("Correo inválido");
        if (telefonoFmt && !isValidPhone(telefonoFmt)) errorMsg.push("Teléfono inválido");
        
        if (emailFmt) {
           if (seenEmails.has(emailFmt)) {
              errorMsg.push("Correo duplicado");
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
          alicuota: isAliValid ? aliNum : alicuota,
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
    e.target.value = null; 
  };

  // 💡 LÓGICA DE GUARDADO MEJORADA CON PROGRESO
  const handleSaveLote = async () => {
    if (loteErrors > 0) return alert("Por favor corrija los errores en el Excel antes de continuar.");
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
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
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
      const data = await res.json();
      
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
        alert("Error del servidor: " + (data.error || data.message)); 
      }
    } catch (err) { 
      clearInterval(progressInterval);
      setIsUploadingLote(false);
      setUploadProgress(0);
      alert("Error de conexión al cargar lote."); 
    } 
  };

  // Cálculos y Paginación
  let saldoAcumulado = 0;
  const dataConSaldo = estadoCuentaData.map((mov) => { saldoAcumulado += parseFloat(mov.cargo) - parseFloat(mov.abono); return { ...mov, saldoFila: saldoAcumulado }; });
  const estadoCuentaFiltrado = dataConSaldo.filter((m) => { if (!fechaDesde && !fechaHasta) return true; const f = new Date(m.fecha_registro); if (fechaDesde && f < new Date(fechaDesde)) return false; if (fechaHasta && f > new Date(fechaHasta)) return false; return true; });
  const totalCargo = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.cargo), 0);
  const totalAbono = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.abono), 0);

  const filteredProps = propiedades.filter((p) => p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) || p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredProps.length / itemsPerPage);
  const currentProps = filteredProps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
                  {currentProps.map((p) => {
                    const saldo = parseFloat(p.saldo_actual || 0);
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
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">← Anterior</button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-5 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-all shadow-sm">Siguiente →</button>
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
        handleOpenAjuste={handleOpenAjuste}
        loadingCuenta={loadingCuenta}
        estadoCuentaFiltrado={estadoCuentaFiltrado}
        totalCargo={totalCargo}
        totalAbono={totalAbono}
      />

      <ModalPropiedadForm
        isOpen={isModalOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        setIsModalOpen={setIsModalOpen}
      />

      <ModalAjusteSaldo
        isOpen={ajusteModalOpen}
        selectedPropAjuste={selectedPropAjuste}
        setAjusteModalOpen={setAjusteModalOpen}
        formAjuste={formAjuste}
        setFormAjuste={setFormAjuste}
        handleSubmitAjuste={handleSubmitAjuste}
      />

      <ModalCargaMasiva 
        isOpen={loteModalOpen}
        setLoteModalOpen={setLoteModalOpen}
        loteData={loteData}
        setLoteData={setLoteData}
        loteErrors={loteErrors}
        isUploadingLote={isUploadingLote}
        uploadProgress={uploadProgress} 
        handleDownloadTemplate={handleDownloadTemplate}
        handleSaveLote={handleSaveLote}
        handleFileUpload={handleFileUpload}
      />

    </div>
  );
}
