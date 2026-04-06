import React, { useCallback, useEffect, useState } from 'react';
import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import ModalFondos from '../components/ModalFondos';
import { API_BASE_URL } from '../config/api';
import { useDialog } from '../components/ui/DialogProvider';
import PageHeader from '../components/ui/PageHeader';
import { BancoCard, BancoFormModal } from '../components/bancos';
import type { Banco, Fondo } from '../components/bancos';
import { inferBancoMoneda, preserveBancosOrder } from '../components/bancos/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OutletContextType {
  userRole?: string;
}

interface BancosResponse {
  status: string;
  bancos: Banco[];
  message?: string;
}

interface FondosResponse {
  status: string;
  fondos: Fondo[];
  message?: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────

const Bancos: FC = () => {
  const { userRole } = useOutletContext<OutletContextType>();
  const { showAlert } = useDialog();

  // State: Data
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // State: Modals
  const [selectedBancoForFondos, setSelectedBancoForFondos] = useState<Banco | null>(null);
  const [fondosRefreshKey, setFondosRefreshKey] = useState<number>(0);
  const [bancoToEdit, setBancoToEdit] = useState<Banco | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem('habioo_token');
    try {
      const [resBancos, resFondos] = await Promise.all([
        fetch(`${API_BASE_URL}/bancos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/fondos`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const dataBancos: BancosResponse = await resBancos.json();
      const dataFondos: FondosResponse = await resFondos.json();

      if (dataBancos.status === 'success') {
        setBancos((prev: Banco[]) => preserveBancosOrder(dataBancos.bancos, prev));
      }
      if (dataFondos.status === 'success') {
        setFondos(dataFondos.fondos);
      }
    } catch (error) {
      console.error('Error fetching bancos/fondos:', error);
      await showAlert({
        title: 'Error de conexion',
        message: 'No se pudieron cargar bancos y fondos.',
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    if (userRole === 'Administrador') {
      fetchData();
    }
  }, [userRole, fetchData]);

  // ─── Modal Handlers ─────────────────────────────────────────────────────

  const handleOpenCreateModal = useCallback((): void => {
    setBancoToEdit(null);
  }, []);

  const handleOpenEditModal = useCallback((banco: Banco): void => {
    setBancoToEdit(banco);
  }, []);

  const handleCloseFormModal = useCallback((): void => {
    setBancoToEdit(null);
  }, []);

  const handleSuccessForm = useCallback((): Promise<void> => {
    setBancoToEdit(null);
    return fetchData();
  }, [fetchData]);

  const handleOpenFondos = useCallback((banco: Banco): void => {
    setSelectedBancoForFondos(banco);
  }, []);

  const handleCloseFondos = useCallback((): Promise<void> => {
    setSelectedBancoForFondos(null);
    setFondosRefreshKey((prev: number) => prev + 1);
    return fetchData();
  }, [fetchData]);

  // ─── Banco Actions ──────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: number): Promise<void> => {
      // Delete logic will be handled by API call directly
      // This could be moved to a custom hook in the future
      const token = localStorage.getItem('habioo_token');
      try {
        const res = await fetch(`${API_BASE_URL}/bancos/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (res.ok && data.status === 'success') {
          await fetchData();
        } else {
          await showAlert({
            title: 'Error',
            message: data.message || 'No se pudo eliminar la cuenta',
            variant: 'danger',
          });
        }
      } catch (error) {
        console.error('Error deleting banco:', error);
        await showAlert({
          title: 'Error de conexion',
          message: 'No se pudo eliminar la cuenta.',
          variant: 'danger',
        });
      }
    },
    [fetchData, showAlert]
  );

  const handleSetPredeterminada = useCallback(
    async (id: number): Promise<void> => {
      const token = localStorage.getItem('habioo_token');
      try {
        const res = await fetch(`${API_BASE_URL}/bancos/${id}/predeterminada`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await res.json();

        if (res.ok && result.status === 'success') {
          await fetchData();
        } else {
          await showAlert({
            title: 'Error',
            message: result.message || 'Error al actualizar la cuenta principal.',
            variant: 'danger',
          });
        }
      } catch (error) {
        console.error('Error updating cuenta principal:', error);
        await showAlert({
          title: 'Error de red',
          message: 'No se pudo actualizar la cuenta principal.',
          variant: 'danger',
        });
      }
    },
    [fetchData, showAlert]
  );

  // ─── Permission & Loading Guards ────────────────────────────────────────

  if (userRole !== 'Administrador') {
    return <p className="p-6 text-gray-500">No tienes permisos para ver esta seccion.</p>;
  }

  if (loading) {
    return <p className="p-6 text-gray-500">Cargando cuentas...</p>;
  }

  // ─── Derived Data ───────────────────────────────────────────────────────

  const cuentasBs = bancos.filter((b: Banco) => inferBancoMoneda(b) === 'BS');
  const cuentasUsd = bancos.filter((b: Banco) => inferBancoMoneda(b) === 'USD');
  const hasPrincipalBs = cuentasBs.some((b: Banco) => b.es_predeterminada);
  const hasPrincipalUsd = cuentasUsd.some((b: Banco) => b.es_predeterminada);

  const hasMissingPrincipalWarning =
    bancos.length > 0 &&
    ((!hasPrincipalBs && cuentasBs.length > 0) || (!hasPrincipalUsd && cuentasUsd.length > 0));

  const hasMissingFondosWarning =
    bancos.length > 0 &&
    bancos.some((b: Banco) => b.es_predeterminada) &&
    bancos.some((b: Banco) => !fondos.some((f: Fondo) => f.cuenta_bancaria_id === b.id));

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Cuentas Bancarias"
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="bg-gray-800 hover:bg-gray-900 text-white dark:bg-donezo-primary dark:hover:bg-blue-600 font-bold py-2 px-5 rounded-xl transition-all shadow-md text-sm flex items-center gap-2"
          >
            + Agregar Cuenta
          </button>
        }
      />

      {/* Warnings */}
      {hasMissingPrincipalWarning && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded-xl shadow-sm">
          <p className="text-yellow-800 dark:text-yellow-300 font-medium text-sm">
            <strong className="block mb-1 text-base">⚠️ Falta asignar cuenta principal por moneda</strong>
            Debe existir una cuenta principal en Bs y otra en USD (si hay cuentas de ese tipo) para que los inmuebles registren pagos correctamente.
            {!hasPrincipalBs && cuentasBs.length > 0 && <span className="block">Pendiente principal Bs.</span>}
            {!hasPrincipalUsd && cuentasUsd.length > 0 && <span className="block">Pendiente principal USD.</span>}
          </p>
        </div>
      )}

      {hasMissingFondosWarning && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-xl shadow-sm">
          <p className="text-blue-800 dark:text-blue-300 font-medium text-sm">
            <strong className="block mb-1 text-base">ℹ️ Falta configurar fondos en sus cuentas</strong>
            Debe agregar mínimo un fondo (ej. Fondo Operativo) a sus cuentas bancarias para que los ingresos puedan ser distribuidos correctamente.
            Por favor, haga clic en el botón <span className="font-bold">Gestionar Fondos</span> en la cuenta correspondiente.
          </p>
        </div>
      )}

      {/* Bancos List */}
      {bancos.length === 0 ? (
        <p className="text-gray-500 text-center py-10 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          No hay cuentas registradas.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {bancos.map((banco: Banco) => (
            <BancoCard
              key={banco.id}
              banco={banco}
              fondos={fondos}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
              onOpenFondos={handleOpenFondos}
              onSetPredeterminada={handleSetPredeterminada}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {bancoToEdit !== null && (
        <BancoFormModal
          bancoEditar={bancoToEdit}
          onClose={handleCloseFormModal}
          onSuccess={handleSuccessForm}
        />
      )}

      {/* Fondos Management Modal */}
      {selectedBancoForFondos && (
        <ModalFondos
          cuenta={selectedBancoForFondos}
          refreshKey={fondosRefreshKey}
          onClose={handleCloseFondos}
        />
      )}
    </div>
  );
};

export default Bancos;
