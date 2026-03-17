import type { FC } from 'react';
import EstadoCuentaBancariaView from '../../components/libro-mayor/EstadoCuentaBancariaView';

const EstadoCuentaPropietario: FC = () => {
  return <EstadoCuentaBancariaView mode="owner" />;
};

export default EstadoCuentaPropietario;
