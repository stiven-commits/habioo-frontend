import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../utils/currency';

interface DashboardHomeProps {}

type UserRole = 'Propietario' | 'Administrador' | string;

interface DashboardUser {
  nombre?: string;
}

interface OutletContextType {
  user?: DashboardUser;
  userRole?: UserRole;
}

interface PropiedadResumen {
  rol: string;
  identificador: string;
  condominio_nombre: string;
}

interface FinanzasResumen {
  deuda_actual: number;
  total_pagado: number;
  recibos_pendientes: number;
}

interface PropsApiResponse {
  status: string;
  propiedades: PropiedadResumen[];
}

interface FinanzasApiResponse {
  status: string;
  finanzas: FinanzasResumen;
}

const DashboardHome: FC<DashboardHomeProps> = () => {
  const { user, userRole } = useOutletContext<OutletContextType>();
  const [propiedades, setPropiedades] = useState<PropiedadResumen[]>([]);
  const [finanzas, setFinanzas] = useState<FinanzasResumen>({ deuda_actual: 0, total_pagado: 0, recibos_pendientes: 0 });

  useEffect(() => {
    const token = localStorage.getItem('habioo_token');
    if (!token) return;

    const fetchData = async (): Promise<void> => {
      try {
        const resProps = await fetch('https://auth.habioo.cloud/mis-propiedades', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataProps: PropsApiResponse = await resProps.json();
        if (dataProps.status === 'success') {
          setPropiedades(dataProps.propiedades);
        }

        const resFinanzas = await fetch('https://auth.habioo.cloud/mis-finanzas', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataFinanzas: FinanzasApiResponse = await resFinanzas.json();
        if (dataFinanzas.status === 'success') {
          setFinanzas(dataFinanzas.finanzas);
        }
      } catch (error) {
        console.error('Error cargando dashboard:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-donezo-green to-emerald-600 text-white p-6 rounded-3xl shadow-lg">
          <p className="text-sm opacity-90 mb-2">Total Pagado</p>
          <h3 className="text-3xl font-bold">${formatMoney(finanzas.total_pagado)}</h3>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Mi Deuda Actual</p>
          <h3 className="text-3xl font-bold text-gray-800 dark:text-white">${formatMoney(finanzas.deuda_actual)}</h3>
        </div>
        <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Recibos Pendientes</p>
          <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{finanzas.recibos_pendientes}</h3>
        </div>
      </section>

      {userRole === 'Propietario' && (
        <section>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Mis Propiedades</h2>
          {propiedades.length === 0 ? (
            <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-yellow-200 dark:border-yellow-900 mb-8">
              <p className="text-gray-600 dark:text-gray-300">Aun no tienes propiedades vinculadas a tu cedula. Si eres propietario, contacta a tu Junta de Condominio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {propiedades.map((prop: PropiedadResumen, index: number) => (
                <div key={index} className="bg-gradient-to-br from-donezo-primary to-donezo-green p-6 rounded-3xl shadow-lg text-white transform hover:scale-105 transition-transform">
                  <div className="text-sm bg-white/20 inline-block px-3 py-1 rounded-full mb-3">{prop.rol}</div>
                  <h3 className="text-2xl font-bold">{prop.identificador}</h3>
                  <p className="opacity-90">{prop.condominio_nombre}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {userRole === 'Administrador' && (
        <section className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-300">Bienvenido, {user?.nombre}. Usa el menú lateral para gestionar proveedores y gastos.</p>
        </section>
      )}
    </div>
  );
};

export default DashboardHome;
