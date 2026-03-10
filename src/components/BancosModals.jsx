import React, { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../utils/currency';
import { API_BASE_URL } from '../config/api';
import { useDialog } from './ui/DialogProvider';

function parseNumber(val) {
  return parseFloat(String(val || '').replace(/\./g, '').replace(',', '.')) || 0;
}

function formatNumberInput(value, maxDecimals = 2) {
  let cleaned = String(value || '').replace(/[^0-9,]/g, '');
  const parts = cleaned.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const integerPart = parts[0];
  const decimalPart = (parts[1] || '').slice(0, maxDecimals);
  return decimalPart ? `${integerPart},${decimalPart}` : integerPart;
}

export function ModalPagoProveedor({ onClose, onSuccess }) {
  const { showAlert, showConfirm } = useDialog();

  const [fondos, setFondos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingBCV, setIsFetchingBCV] = useState(false);

  const [form, setForm] = useState({
    gasto_id: '',
    fondo_id: '',
    monto_origen: '',
    tasa_cambio: '',
    referencia: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    nota: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('habioo_token');
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [resFondos, resGastos] = await Promise.all([
          fetch(`${API_BASE_URL}/fondos`, { headers }),
          fetch(`${API_BASE_URL}/gastos-pendientes-pago`, { headers }),
        ]);
        const dataFondos = await resFondos.json();
        const dataGastos = await resGastos.json();

        if (dataFondos.status === 'success') setFondos(dataFondos.fondos);
        if (dataGastos.status === 'success') setGastos(dataGastos.gastos);
      } catch (error) {
        console.error(error);
        await showAlert({ title: 'Error', message: 'No se pudieron cargar fondos y gastos pendientes.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const selectedFondo = fondos.find((f) => f.id.toString() === form.fondo_id);
  const isBs = selectedFondo?.moneda === 'BS';

  const fetchBCV = async () => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const json = await response.json();
      if (json?.promedio) setForm((prev) => ({ ...prev, tasa_cambio: String(json.promedio) }));
    } catch {
      await showAlert({ title: 'BCV no disponible', message: 'No se pudo obtener la tasa BCV.', variant: 'warning' });
    } finally {
      setIsFetchingBCV(false);
    }
  };

  const montoUsd = useMemo(() => {
    const monto = parseFloat(form.monto_origen) || 0;
    const tasa = parseFloat(form.tasa_cambio) || 1;
    return isBs ? monto / tasa : monto;
  }, [form.monto_origen, form.tasa_cambio, isBs]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const ok = await showConfirm({
      title: 'Confirmar pago',
      message: `Se aplicara un pago por $${formatMoney(montoUsd)} al proveedor.`,
      confirmText: 'Procesar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/pagos-proveedores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          monto_usd: montoUsd.toFixed(2),
          monto_bs: isBs ? form.monto_origen : null,
        }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        await showAlert({ title: 'Pago registrado', message: result.message, variant: 'success' });
        onSuccess();
      } else {
        await showAlert({ title: 'Error', message: result.error || 'No se pudo procesar el pago.', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de red', message: 'No se pudo registrar el pago.', variant: 'danger' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Pagar a Proveedor</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Factura Pendiente *</label>
              <select required value={form.gasto_id} onChange={(e) => setForm({ ...form, gasto_id: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary">
                <option value="">Seleccione una factura...</option>
                {gastos.map((g) => (
                  <option key={g.id} value={g.id}>{g.proveedor} - {g.concepto} (Debe: ${g.deuda_restante})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fondo de Origen *</label>
              <select required value={form.fondo_id} onChange={(e) => setForm({ ...form, fondo_id: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary">
                <option value="">Seleccione un fondo...</option>
                {fondos.map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre} ({f.moneda}) - Disp: {f.moneda === 'USD' ? '$' : 'Bs'}{formatMoney(f.saldo_actual)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto Pagado ({selectedFondo ? selectedFondo.moneda : '?'}) *</label>
                <input required type="number" step="0.01" value={form.monto_origen} onChange={(e) => setForm({ ...form, monto_origen: e.target.value })} placeholder="0.00" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>

              {isBs && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa BCV *</label>
                  <div className="flex gap-2">
                    <input required type="number" step="0.01" value={form.tasa_cambio} onChange={(e) => setForm({ ...form, tasa_cambio: e.target.value })} placeholder="Ej: 36.50" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                    <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-3 rounded-xl font-bold border border-blue-300 dark:border-blue-700">
                      {isFetchingBCV ? '...' : 'BCV'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedFondo && form.monto_origen && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800/50 flex justify-between items-center">
                <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Se descontara:</span>
                <span className="font-black text-red-600 dark:text-red-300 text-lg">${formatMoney(montoUsd)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia *</label>
                <input required type="text" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha *</label>
                <input required type="date" max={new Date().toISOString().split('T')[0]} value={form.fecha_pago} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-donezo-primary text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg">Confirmar Pago a Proveedor</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ModalTransferencia({ onClose, onSuccess }) {
  const { showAlert, showConfirm } = useDialog();

  const [fondos, setFondos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingBCV, setIsFetchingBCV] = useState(false);

  const [form, setForm] = useState({
    fondo_origen_id: '',
    fondo_destino_id: '',
    monto_origen: '',
    tasa_cambio: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0],
    nota: '',
  });

  useEffect(() => {
    const fetchFondos = async () => {
      const token = localStorage.getItem('habioo_token');
      try {
        const res = await fetch(`${API_BASE_URL}/fondos`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === 'success') setFondos(data.fondos);
      } catch (error) {
        console.error(error);
        await showAlert({ title: 'Error', message: 'No se pudieron cargar los fondos.', variant: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    fetchFondos();
  }, []);

  const fondoOrigen = fondos.find((f) => f.id.toString() === form.fondo_origen_id);
  const fondosDestino = fondos.filter((f) => f.id.toString() !== form.fondo_origen_id);
  const fondoDestino = fondos.find((f) => f.id.toString() === form.fondo_destino_id);

  const isDifferentCurrency = fondoOrigen && fondoDestino && fondoOrigen.moneda !== fondoDestino.moneda;
  const involvesBs = fondoOrigen && fondoDestino && (fondoOrigen.moneda === 'BS' || fondoDestino.moneda === 'BS');

  let montoDestinoFinal = parseNumber(form.monto_origen);
  if (isDifferentCurrency && form.monto_origen && form.tasa_cambio) {
    const monto = parseNumber(form.monto_origen);
    const tasa = parseNumber(form.tasa_cambio);
    if (fondoOrigen.moneda === 'BS' && fondoDestino.moneda === 'USD') montoDestinoFinal = Number((monto / tasa).toFixed(2));
    if (fondoOrigen.moneda === 'USD' && fondoDestino.moneda === 'BS') montoDestinoFinal = Number((monto * tasa).toFixed(2));
  }

  const montoOrigenNum = parseNumber(form.monto_origen);
  const tasaNum = parseNumber(form.tasa_cambio);
  const montoUsdEquivalente = fondoOrigen
    ? (fondoOrigen.moneda === 'USD' ? montoOrigenNum : (tasaNum > 0 ? montoOrigenNum / tasaNum : 0))
    : 0;

  const isTransferFormValid = Boolean(
    form.fondo_origen_id &&
    form.fondo_destino_id &&
    montoOrigenNum > 0 &&
    form.referencia.trim() &&
    form.fecha &&
    (!involvesBs || tasaNum > 0)
  );

  const fetchBCV = async () => {
    setIsFetchingBCV(true);
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const json = await response.json();
      if (json?.promedio) {
        setForm((prev) => ({ ...prev, tasa_cambio: formatNumberInput(String(json.promedio).replace('.', ','), 2) }));
      }
    } catch {
      await showAlert({ title: 'BCV no disponible', message: 'No se pudo obtener la tasa BCV.', variant: 'warning' });
    } finally {
      setIsFetchingBCV(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.fondo_origen_id || !form.fondo_destino_id) {
      await showAlert({ title: 'Campos requeridos', message: 'Seleccione fondo de origen y destino.', variant: 'warning' });
      return;
    }
    if (montoOrigenNum <= 0) {
      await showAlert({ title: 'Monto invalido', message: 'El monto a transferir debe ser mayor a 0.', variant: 'warning' });
      return;
    }
    if (involvesBs && tasaNum <= 0) {
      await showAlert({ title: 'Tasa requerida', message: 'Debe indicar una tasa BCV valida para calcular USD.', variant: 'warning' });
      return;
    }

    const ok = await showConfirm({
      title: 'Confirmar transferencia',
      message: `Se transferiran ${form.monto_origen} ${fondoOrigen.moneda} hacia ${fondoDestino.nombre}.`,
      confirmText: 'Transferir',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/transferencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          monto_origen: montoOrigenNum,
          tasa_cambio: tasaNum || null,
          monto_destino: montoDestinoFinal,
        }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        await showAlert({ title: 'Transferencia aplicada', message: result.message, variant: 'success' });
        onSuccess();
      } else {
        await showAlert({ title: 'Error', message: result.error || 'No se pudo transferir.', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de red', message: 'No se pudo procesar la transferencia.', variant: 'danger' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 custom-scrollbar max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">Transferir Dinero</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        {loading ? <p className="text-center text-gray-500">Cargando fondos...</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Sale de (Origen) *</label>
              <select required value={form.fondo_origen_id} onChange={(e) => setForm({ ...form, fondo_origen_id: e.target.value, fondo_destino_id: '' })} className="w-full p-3 rounded-xl border border-blue-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-blue-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-400 font-semibold">
                <option value="">Seleccione fondo origen...</option>
                {fondos.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda}) - Disp: {f.moneda === 'USD' ? '$' : 'Bs'}{formatMoney(f.saldo_actual)}</option>)}
              </select>
            </div>

            {fondoOrigen && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">Entra a (Destino) *</label>
                <select required value={form.fondo_destino_id} onChange={(e) => setForm({ ...form, fondo_destino_id: e.target.value })} className="w-full p-3 rounded-xl border border-indigo-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-indigo-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-400 font-semibold">
                  <option value="">Seleccione fondo destino...</option>
                  {fondosDestino.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda})</option>)}
                </select>
              </div>
            )}

            {fondoOrigen && fondoDestino && (
              <div className="animate-fadeIn space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto a Enviar *</label>
                    <input required type="text" value={form.monto_origen} onChange={(e) => setForm({ ...form, monto_origen: formatNumberInput(e.target.value, 2) })} placeholder="Ej: 1.500,00" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>

                  {involvesBs && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tasa de Cambio (max 2 decimales) *</label>
                      <div className="flex gap-2">
                        <input required type="text" value={form.tasa_cambio} onChange={(e) => setForm({ ...form, tasa_cambio: formatNumberInput(e.target.value, 2) })} placeholder="Ej: 36,50" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                        <button type="button" onClick={fetchBCV} disabled={isFetchingBCV} className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-3 rounded-xl font-bold border border-blue-300 dark:border-blue-700 transition-all hover:bg-blue-200 dark:hover:bg-blue-900/60">
                          {isFetchingBCV ? '...' : 'BCV'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {form.monto_origen && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/50 flex justify-between items-center">
                    <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Destino recibe (equiv. USD):</span>
                    <span className="font-black text-green-600 dark:text-green-300 text-lg">${formatMoney(montoUsdEquivalente)}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referencia *</label>
                    <input required type="text" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value.replace(/\s/g, '') })} placeholder="Sin espacios" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fecha *</label>
                    <input required type="date" max={new Date().toISOString().split('T')[0]} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota (Opcional)</label>
                  <textarea rows="2" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Motivo de la transferencia" className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100 outline-none focus:ring-2 focus:ring-donezo-primary resize-none" />
                </div>

                <button type="submit" disabled={!isTransferFormValid} className="w-full py-3 mt-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  Procesar Transferencia
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export function ModalEliminarFondo({ fondo, fondosDisponibles, onClose, onSuccess }) {
  const { showAlert, showConfirm } = useDialog();

  const [destinoId, setDestinoId] = useState('');
  const [loading, setLoading] = useState(false);

  const saldo = parseFloat(fondo?.saldo_actual || 0);
  const fondosDestino = fondosDisponibles.filter((f) => f.id !== fondo.id && f.moneda === fondo.moneda);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saldo > 0 && !destinoId) {
      await showAlert({ title: 'Destino requerido', message: 'Debe seleccionar un fondo destino para resguardar el saldo.', variant: 'warning' });
      return;
    }

    const ok = await showConfirm({
      title: 'Eliminar fondo',
      message: `Se eliminara el fondo ${fondo.nombre}.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    setLoading(true);
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch(`${API_BASE_URL}/fondos/${fondo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(saldo > 0 ? { destino_id: destinoId } : {}),
      });
      const result = await res.json();
      if (result.status === 'success') {
        await showAlert({ title: 'Fondo eliminado', message: result.message, variant: 'success' });
        onSuccess();
      } else {
        await showAlert({ title: 'Error', message: result.error || result.message || 'No se pudo eliminar.', variant: 'danger' });
      }
    } catch (error) {
      await showAlert({ title: 'Error de red', message: 'No se pudo conectar con el servidor.', variant: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  if (!fondo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Eliminar Fondo</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 font-bold text-xl">X</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Esta accion desactiva el fondo <strong>{fondo.nombre}</strong>. El historial de movimientos se conserva para auditoria.
          </p>

          {saldo > 0 ? (
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50">
              <p className="text-xs font-bold text-orange-700 dark:text-orange-300 mb-3 uppercase tracking-wider">
                Saldo restante: {fondo.moneda === 'USD' ? '$' : 'Bs'} {formatMoney(saldo)}
              </p>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fondo destino (obligatorio, misma moneda) *</label>
              <select required value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="w-full p-3 rounded-xl border border-orange-300 bg-white text-gray-900 dark:bg-gray-900 dark:border-orange-700 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Seleccione fondo destino...</option>
                {fondosDestino.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.moneda})</option>)}
              </select>
              {fondosDestino.length === 0 && (
                <p className="text-xs text-red-500 mt-2 font-bold">No hay otros fondos en {fondo.moneda}. Cree uno primero.</p>
              )}
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800/50 mt-4">
              <p className="text-sm font-bold text-green-700 dark:text-green-300">Este fondo tiene saldo en cero y se puede eliminar directamente.</p>
            </div>
          )}

          <button type="submit" disabled={loading || (saldo > 0 && fondosDestino.length === 0)} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 mt-4">
            {loading ? 'Procesando...' : 'Confirmar Eliminacion'}
          </button>
        </form>
      </div>
    </div>
  );
}
