import type { FC } from 'react';
import StatusBadge from '../ui/StatusBadge';

interface EstadoConciliacionBadgeProps {
  estado: string;
}

const EstadoConciliacionBadge: FC<EstadoConciliacionBadgeProps> = ({ estado }) => {
  const key = String(estado || '').trim().toUpperCase();
  if (key === 'CONCILIADO') return <StatusBadge color="green" shape="badge" border>Conciliado</StatusBadge>;
  if (key === 'ABONADO') return <StatusBadge color="yellow" shape="badge" border>Abonado</StatusBadge>;
  if (key === 'PENDIENTE_VINCULACION') return <StatusBadge color="blue" shape="badge" border>Pendiente vinculación</StatusBadge>;
  return <StatusBadge color="red" shape="badge" border>Pendiente</StatusBadge>;
};

export default EstadoConciliacionBadge;
