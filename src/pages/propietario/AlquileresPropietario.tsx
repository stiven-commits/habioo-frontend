import { useState, type FC } from 'react';
import VistaAlquileresPropietario from '../../components/alquileres/VistaAlquileresPropietario';
import VistaMisReservas from '../../components/alquileres/VistaMisReservas';

type TabMode = 'espacios' | 'solicitudes';

const AlquileresPropietario: FC = () => {
  const [tab, setTab] = useState<TabMode>('espacios');

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-donezo-card-dark p-6 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('espacios')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === 'espacios'
                ? 'bg-donezo-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            Espacios
          </button>
          <button
            type="button"
            onClick={() => setTab('solicitudes')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === 'solicitudes'
                ? 'bg-donezo-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            Ver Solicitudes
          </button>
        </div>
      </div>

      {tab === 'espacios' ? <VistaAlquileresPropietario /> : <VistaMisReservas />}
    </section>
  );
};

export default AlquileresPropietario;
