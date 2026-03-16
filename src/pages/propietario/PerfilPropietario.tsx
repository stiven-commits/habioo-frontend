import type { FC } from 'react';
import { useOutletContext } from 'react-router-dom';

interface User {
  nombre: string;
  cedula?: string;
  email?: string;
  telefono?: string;
}

interface PropiedadActiva {
  identificador: string;
  nombre_condominio: string;
}

interface OutletContextType {
  userRole?: string;
  user?: User;
  propiedadActiva?: PropiedadActiva | null;
}

const PerfilPropietario: FC = () => {
  const { userRole, user, propiedadActiva } = useOutletContext<OutletContextType>();

  if (userRole !== 'Propietario') return <p className="p-6">No tienes permisos.</p>;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
        <h2 className="text-xl font-black text-gray-800 dark:text-white">Mi Perfil</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Datos del propietario en el inmueble activo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Nombre</p>
          <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-200">{user?.nombre || '-'}</p>

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Cédula</p>
          <p className="mt-1 text-base font-semibold text-gray-700 dark:text-gray-300">{user?.cedula || '-'}</p>

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Email</p>
          <p className="mt-1 text-base font-semibold text-gray-700 dark:text-gray-300">{user?.email || '-'}</p>

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Teléfono</p>
          <p className="mt-1 text-base font-semibold text-gray-700 dark:text-gray-300">{user?.telefono || '-'}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-donezo-card-dark">
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">Inmueble Activo</p>
          <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-200">{propiedadActiva?.identificador || '-'}</p>

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-gray-400">Condominio</p>
          <p className="mt-1 text-base font-semibold text-gray-700 dark:text-gray-300">{propiedadActiva?.nombre_condominio || '-'}</p>
        </div>
      </div>
    </section>
  );
};

export default PerfilPropietario;

