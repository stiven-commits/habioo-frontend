import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import PanelElecciones from '../components/junta-general/PanelElecciones';

const EleccionesAdmin: FC = () => {
  const { condominioId: condominioIdParam } = useParams<{ condominioId?: string }>();
  const parsed = Number.parseInt(String(condominioIdParam || ''), 10);
  const condominioId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  return (
    <div className="space-y-5">
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Elecciones</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gestiona el proceso electoral de la junta de condominio.
        </p>
      </section>

      <PanelElecciones condominioId={condominioId} />
    </div>
  );
};

export default EleccionesAdmin;
