import type { FC } from 'react';
import PanelEleccionesBase from '../elecciones/PanelElecciones';

interface PanelEleccionesProps {
  condominioId?: number | null;
  className?: string;
}

const PanelElecciones: FC<PanelEleccionesProps> = ({ condominioId = null, className = '' }) => {
  return <PanelEleccionesBase condominioId={condominioId} className={className} />;
};

export default PanelElecciones;
