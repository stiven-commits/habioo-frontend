import type { FC } from 'react';
import EstadoCuentaBancariaView from '../components/libro-mayor/EstadoCuentaBancariaView';

const EstadoCuentasBancarias: FC = () => {
  return <EstadoCuentaBancariaView mode="admin" />;
};

export default EstadoCuentasBancarias;
