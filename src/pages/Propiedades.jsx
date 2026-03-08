import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { ModalAjusteSaldo, ModalEstadoCuenta, ModalPropiedadForm } from '../components/propiedades/PropiedadesModals';

export default function Propiedades() {
  const { userRole } = useOutletContext();
  const [propiedades, setPropiedades] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const initialForm = {
    identificador: '', alicuota: '', prop_nombre: '', prop_cedula: '', prop_email: '', prop_telefono: '', prop_password: '',
    tiene_inquilino: false, inq_nombre: '', inq_cedula: '', inq_email: '', inq_telefono: '', inq_password: '',
    monto_saldo_inicial: '', tipo_saldo_inicial: 'CERO'
  };

  const [form, setForm] = useState(initialForm);

  const fetchPropiedades = async () => {
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setPropiedades(data.propiedades);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'Administrador') fetchPropiedades();
  }, [userRole]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchEstadoCuenta = async (propId) => {
    setLoadingCuenta(true);
    try {
      const token = localStorage.getItem('habioo_token');
      const res = await fetch(`${API_BASE_URL}/propiedades-admin/${propId}/estado-cuenta`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.status === 'success') setEstadoCuentaData(data.movimientos);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCuenta(false);
    }
  };

  const handleOpenEstadoCuenta = (prop) => {
    setOpenDropdownId(null);
    setSelectedPropCuenta(prop);
    setFechaDesde('');
    setFechaHasta('');
    fetchEstadoCuenta(prop.id);
    setEstadoCuentaModalOpen(true);
  };

  const handleOpenAjuste = (prop) => {
    setSelectedPropAjuste(prop);
    setFormAjuste({ monto: '', tipo_ajuste: 'CARGAR_DEUDA', nota: '' });
    setAjusteModalOpen(true);
  };

  const formatCedula = (val) => {
    const raw = val.toUpperCase().replace(/[^VEJPG0-9]/g, '');
    if (!raw) return '';
    const letra = raw.charAt(0);
    if (!['V', 'E', 'J', 'P', 'G'].includes(letra)) return '';
    return `${letra}${raw.slice(1).replace(/[^0-9]/g, '').slice(0, 9)}`;
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
    if (type === 'checkbox') {
      setForm({ ...form, [name]: checked });
      return;
    }

    if (name === 'prop_cedula' || name === 'inq_cedula') {
      setForm({ ...form, [name]: formatCedula(value) });
      return;
    }

    if (name === 'alicuota' || name === 'monto_saldo_inicial') {
      let rawVal = value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
      const parts = rawVal.split(',');
      if (parts.length > 2) rawVal = `${parts[0]},${parts.slice(1).join('')}`;
      if (name === 'alicuota') {
        const [entero = '', decimal = ''] = rawVal.split(',');
        rawVal = rawVal.includes(',') ? `${entero},${decimal.slice(0, 3)}` : entero;
      }
      setForm({ ...form, [name]: rawVal });
      return;
    }

    setForm({ ...form, [name]: value });
  };

  const handleEdit = (prop) => {
    setOpenDropdownId(null);
    setEditingId(prop.id);
    setForm({
      identificador: prop.identificador,
      alicuota: formatAlicuotaDisplay(prop.alicuota),
      prop_nombre: prop.prop_nombre || '',
      prop_cedula: prop.prop_cedula || '',
      prop_email: prop.prop_email || '',
      prop_telefono: prop.prop_telefono || '',
      prop_password: '',
      tiene_inquilino: !!prop.inq_cedula,
      inq_nombre: prop.inq_nombre || '',
      inq_cedula: prop.inq_cedula || '',
      inq_email: prop.inq_email || '',
      inq_telefono: prop.inq_telefono || '',
      inq_password: '',
      monto_saldo_inicial: '',
      tipo_saldo_inicial: 'CERO'
    });
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const alicuotaNum = parseFloat(form.alicuota.toString().replace(',', '.'));
    if (isNaN(alicuotaNum) || alicuotaNum <= 0 || alicuotaNum > 100) {
      alert('⚠️ Error: La alícuota debe ser un porcentaje mayor a 0 y máximo 100.');
      return;
    }

    const token = localStorage.getItem('habioo_token');
    const url = editingId ? `${API_BASE_URL}/propiedades-admin/${editingId}` : `${API_BASE_URL}/propiedades-admin`;

    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (data.status === 'success') {
      setIsModalOpen(false);
      fetchPropiedades();
    } else {
      alert(data.error || data.message);
    }
  };

  const handleSubmitAjuste = async (e) => {
    e.preventDefault();
    if (!confirm(`¿Registrar ajuste para ${selectedPropAjuste.identificador}?`)) return;
    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`${API_BASE_URL}/propiedades-admin/${selectedPropAjuste.id}/ajustar-saldo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(formAjuste)
    });
    const data = await res.json();
    if (data.status === 'success') {
      alert(data.message);
      setAjusteModalOpen(false);
      fetchPropiedades();
      if (selectedPropCuenta?.id === selectedPropAjuste.id) fetchEstadoCuenta(selectedPropCuenta.id);
    } else {
      alert(data.error);
    }
  };

  let saldoAcumulado = 0;
  const dataConSaldo = estadoCuentaData.map((mov) => {
    saldoAcumulado += parseFloat(mov.cargo) - parseFloat(mov.abono);
    return { ...mov, saldoFila: saldoAcumulado };
  });

  const estadoCuentaFiltrado = dataConSaldo.filter((m) => {
    if (!fechaDesde && !fechaHasta) return true;
    const f = new Date(m.fecha_registro);
    if (fechaDesde && f < new Date(fechaDesde)) return false;
    if (fechaHasta && f > new Date(fechaHasta)) return false;
    return true;
  });

  const totalCargo = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.cargo), 0);
  const totalAbono = estadoCuentaFiltrado.reduce((acc, m) => acc + parseFloat(m.abono), 0);

  const filteredProps = propiedades.filter((p) => p.identificador.toLowerCase().includes(searchTerm.toLowerCase()) || p.prop_nombre?.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredProps.length / itemsPerPage);
  const currentProps = filteredProps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (userRole !== 'Administrador') return <p className="p-6">No tienes permisos.</p>;

  return (
    <div className="space-y-6 relative" onClick={() => setOpenDropdownId(null)}>
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 gap-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏠 Inmuebles y Residentes</h3>
        <div className="flex-1 max-w-md w-full relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input type="text" placeholder="Buscar apartamento o propietario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-primary dark:text-white transition-all"/>
        </div>
        <button onClick={handleCreateNew} className="bg-donezo-primary hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-md">+ Registrar Inmueble</button>
      </div>

      <div className="bg-white dark:bg-donezo-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        {loading ? <p className="text-gray-500 p-6">Cargando...</p> : currentProps.length === 0 ? <p className="text-gray-500 text-center py-10">No hay inmuebles registrados.</p> : (
          <>
            <div className="overflow-x-auto pb-32 pt-2 px-6">
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
                              <button onClick={(e) => { e.stopPropagation(); handleEdit(p); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-50 dark:border-gray-700 transition-colors">✏️ Editar Datos</button>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEstadoCuenta(p); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm text-blue-600 dark:text-blue-400 font-bold transition-colors">📄 Estado de Cuenta</button>
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
    </div>
  );
}
