import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';
import Proveedores from './pages/Proveedores';
import Gastos from './pages/Gastos';
import Cierres from './pages/Cierres';
import Propiedades from './pages/Propiedades';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import Bancos from './pages/Bancos';
import Zonas from './pages/Zonas';
import HistorialAvisos from './pages/HistorialAvisos';
import EstadoCuentasBancarias from './pages/EstadoCuentasBancarias';
import PerfilCondominio from './pages/PerfilCondominio';
import VistaAvisoCobro from './components/recibos/VistaAvisoCobro.tsx';
import RecibosPropietario from './pages/propietario/RecibosPropietario';
import GastosPropietario from './pages/propietario/GastosPropietario';
import EstadoCuentaPropietario from './pages/propietario/EstadoCuentaPropietario';
import PerfilPropietario from './pages/propietario/PerfilPropietario';
import NotificacionesPropietario from './pages/propietario/NotificacionesPropietario';
import { DialogProvider } from './components/ui/DialogProvider';

export default function App() {
  return (
    <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/perfil" element={<PerfilCondominio />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/cierres" element={<Cierres />} />
            <Route path="/inmuebles" element={<Propiedades />} />
            <Route path="/cuentas-cobrar" element={<CuentasPorCobrar />} />
            <Route path="/bancos" element={<Bancos />} />
            <Route path="/estado-cuentas" element={<EstadoCuentasBancarias />} />
            <Route path="/zonas" element={<Zonas />} />
            <Route path="/avisos-cobro" element={<HistorialAvisos />} />
            <Route path="/aviso-cobro/:id" element={<VistaAvisoCobro />} />
            <Route path="/propietario/gastos" element={<GastosPropietario />} />
            <Route path="/propietario/recibos" element={<RecibosPropietario />} />
            <Route path="/propietario/estado-cuenta" element={<EstadoCuentaPropietario />} />
            <Route path="/propietario/perfil" element={<PerfilPropietario />} />
            <Route path="/propietario/notificaciones" element={<NotificacionesPropietario />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DialogProvider>
  );
}
