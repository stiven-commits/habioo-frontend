import { useState, useEffect } from 'react';
import type React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDialog } from '../components/ui/DialogProvider';

interface ZonasProps {}

interface OutletContext {
  userRole: string;
}

interface Propiedad {
  id: number;
  identificador: string;
}

interface Zona {
  id: number;
  nombre: string;
  activa: boolean;
  tiene_gastos: boolean;
  propiedades: Propiedad[];
  propiedades_ids: number[];
}

interface ZonaForm {
  nombre: string;
  propiedades_ids: number[];
  activa: boolean;
}

interface ZonasApiSuccessResponse {
  status: 'success';
  zonas: Zona[];
  todas_propiedades: Propiedad[];
}

interface ApiActionResponse {
  status: string;
  message?: string;
  error?: string;
}

type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

interface ConfirmDialogOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface DialogContextValue {
  showConfirm: (opts: ConfirmDialogOptions) => Promise<boolean>;
}

const Zonas: React.FC<ZonasProps> = () => {
  const { userRole } = useOutletContext<OutletContext>();
  const { showConfirm } = useDialog() as DialogContextValue;
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [allProps, setAllProps] = useState<Propiedad[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Estado para Edicion
  const [editingId, setEditingId] = useState<number | null>(null); // Si es null, es modo CREAR
  const [hasGastos, setHasGastos] = useState<boolean>(false); // Para saber si bloqueamos estructura

  const [form, setForm] = useState<ZonaForm>({ nombre: '', propiedades_ids: [], activa: true });

  const fetchData = async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const res = await fetch('https://auth.habioo.cloud/zonas', { headers: { Authorization: `Bearer ${token}` } });
      const data = (await res.json()) as ZonasApiSuccessResponse;
      if (data.status === 'success') {
        setZonas(data.zonas);
        setAllProps(data.todas_propiedades);
      }
    } catch (error: unknown) {
      console.error(error);
    }
    finally { setLoading(false); }
  };

  useEffect((): void => { if (userRole === 'Administrador') { void fetchData(); } }, [userRole]);

  // Formateador de Texto (Mayuscula inicial)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    // Convierte la primera letra de cada palabra o frase a mayuscula (simple)
    const capitalized = val.charAt(0).toUpperCase() + val.slice(1);
    setForm({ ...form, nombre: capitalized });
  };

  const togglePropiedad = (id: number): void => {
    if (hasGastos && editingId) return; // Bloqueo si estamos editando una zona con gastos

    setForm((prev: ZonaForm) => {
      const exists = prev.propiedades_ids.includes(id);
      return {
        ...prev,
        propiedades_ids: exists
          ? prev.propiedades_ids.filter((pid: number) => pid !== id)
          : [...prev.propiedades_ids, id],
      };
    });
  };

  // Abrir Modal para Crear
  const handleCreate = (): void => {
    setEditingId(null);
    setHasGastos(false);
    setForm({ nombre: '', propiedades_ids: [], activa: true });
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar
  const handleEdit = (zona: Zona): void => {
    setEditingId(zona.id);
    setHasGastos(zona.tiene_gastos); // El backend nos dice si tiene historial
    setForm({
      nombre: zona.nombre,
      propiedades_ids: zona.propiedades_ids || [],
      activa: zona.activa,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (form.propiedades_ids.length === 0) return alert('Selecciona al menos una propiedad');

    const token = localStorage.getItem('habioo_token');
    const url = editingId
      ? `https://auth.habioo.cloud/zonas/${editingId}`
      : 'https://auth.habioo.cloud/zonas';

    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const data = (await res.json()) as ApiActionResponse;

    if (data.status === 'success') {
      alert(data.message);
      setIsModalOpen(false);
      void fetchData();
    } else {
      alert(data.error || 'Error al guardar');
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    const ok = await showConfirm({
      title: 'Eliminar area / sector',
      message: 'Estas seguro de eliminar esta area / sector permanentemente?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;
    const token = localStorage.getItem('habioo_token');
    const res = await fetch(`https://auth.habioo.cloud/zonas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const data = (await res.json()) as ApiActionResponse;
    if (data.status === 'success') {
      void fetchData();
    }
    else alert(data.message); // Mostrara el mensaje de bloqueo si tiene gastos
  };

  // Funcion rapida para cambiar estado (Activar/Desactivar) desde la tarjeta
  const toggleStatus = async (zona: Zona): Promise<void> => {
    const nuevoEstado = !zona.activa;
    const accion = nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR';
    const ok = await showConfirm({
      title: `Confirmar ${accion}`,
      message: `Deseas ${accion} el area / sector "${zona.nombre}" para futuros gastos?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;

    // Reutilizamos el endpoint PUT
    const token = localStorage.getItem('habioo_token');
    await fetch(`https://auth.habioo.cloud/zonas/${zona.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nombre: zona.nombre,
        propiedades_ids: zona.propiedades_ids, // Mantenemos los mismos
        activa: nuevoEstado,
      }),
    });
    void fetchData();
  };

  if (userRole !== 'Administrador') return <p className="p-6">Acceso denegado.</p>;

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center bg-white dark:bg-donezo-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">🏢 Areas / Sectores del Condominio</h3>
        <button onClick={handleCreate} className="bg-donezo-primary hover:bg-green-700 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg shadow-green-500/30">+ Crear Area / Sector</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zonas.map((z: Zona) => (
          <div key={z.id} className={`p-6 rounded-2xl shadow-sm border transition-all ${z.activa ? 'bg-white dark:bg-donezo-card-dark border-gray-100 dark:border-gray-800' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-80'}`}>

            <div className="flex justify-between items-start mb-3">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {z.nombre}
                {!z.activa && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-md dark:text-gray-400">Inactiva</span>}
              </h4>

              <div className="flex gap-1">
                {/* BOTON EDITAR (Siempre visible) */}
                <button onClick={() => handleEdit(z)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Editar detalles">✏️</button>

                {/* LOGICA: Si tiene gastos -> SWITCH ON/OFF. Si no -> BASURA */}
                {z.tiene_gastos ? (
                  <button
                    onClick={() => toggleStatus(z)}
                    className={`p-2 rounded-lg font-bold text-xs ${z.activa ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                    title={z.activa ? 'Desactivar para nuevos gastos' : 'Reactivar area / sector'}
                  >
                    {z.activa ? '⛔' : '✅'}
                  </button>
                ) : (
                  <button onClick={() => handleDelete(z.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar definitivamente">🗑️</button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-xl h-32 overflow-y-auto custom-scrollbar">
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Propiedades ({z.propiedades.length})</p>
              <div className="flex flex-wrap gap-2">
                {z.propiedades.map((p: Propiedad) => (
                  <span key={p.id} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md text-xs font-medium dark:text-gray-300">
                    {p.identificador}
                  </span>
                ))}
              </div>
            </div>

            {z.tiene_gastos && (
              <p className="text-[10px] text-gray-400 mt-2 text-right">🔒 Estructura bloqueada por historial</p>
            )}
          </div>
        ))}
      </div>

      {/* MODAL (CREAR / EDITAR) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-donezo-card-dark rounded-3xl p-6 w-full max-w-2xl shadow-2xl h-[85vh] max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                {editingId ? '✏️ Editar Area / Sector' : '🏢 Nueva Area / Sector'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre del Area / Sector</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={handleNameChange}
                  placeholder="Ej: Torre A, Locales Comerciales..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white transition-all"
                  required
                />
              </div>

              {hasGastos && editingId && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl mb-4 border border-yellow-200 dark:border-yellow-800 flex items-start gap-2">
                  <span className="text-yellow-600">⚠️</span>
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    No puedes modificar los apartamentos de esta area / sector porque ya tiene gastos contables asociados. Solo puedes cambiar el nombre o desactivarla.
                  </p>
                </div>
              )}

              <div className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 ${hasGastos && editingId ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Inmuebles en esta area / sector:</p>
                  <span className="text-xs text-donezo-primary font-bold">{form.propiedades_ids.length} seleccionados</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allProps.map((p: Propiedad) => (
                    <div
                      key={p.id}
                      onClick={() => togglePropiedad(p.id)}
                      className={`p-2 rounded-lg border text-sm font-medium cursor-pointer transition-all flex items-center gap-2 select-none
                        ${form.propiedades_ids.includes(p.id)
                          ? 'bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-donezo-primary'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${form.propiedades_ids.includes(p.id) ? 'bg-donezo-primary border-transparent' : 'border-gray-400'}`}>
                        {form.propiedades_ids.includes(p.id) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <span className="truncate">{p.identificador}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 dark:text-gray-300 font-medium hover:bg-gray-200 transition-colors">Cancelar</button>
                <button type="submit" className="px-6 py-3 rounded-xl bg-donezo-primary text-white font-bold hover:bg-green-700 shadow-md transition-all transform hover:scale-105">
                  {editingId ? 'Guardar Cambios' : 'Crear Area / Sector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Zonas;
