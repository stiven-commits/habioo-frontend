import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import CambioClaveObligatorio from './pages/CambioClaveObligatorio';
import RegistroJunta from './pages/RegistroJunta';
import DashboardHome from './pages/DashboardHome';
import Proveedores from './pages/Proveedores';
import Gastos from './pages/Gastos';
import Cierres from './pages/Cierres';
import Propiedades from './pages/Propiedades';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import Bancos from './pages/Bancos';
import Zonas from './pages/Zonas';
import VistaAlquileres from './pages/VistaAlquileres';
import EncuestasAdmin from './pages/EncuestasAdmin';
import HistorialAvisos from './pages/HistorialAvisos';
import EstadoCuentasBancarias from './pages/EstadoCuentasBancarias';
import PerfilCondominio from './pages/PerfilCondominio';
import JuntaGeneral from './pages/JuntaGeneral';
import VistaAvisoCobro from './components/recibos/VistaAvisoCobro.tsx';
import RecibosPropietario from './pages/propietario/RecibosPropietario';
import GastosPropietario from './pages/propietario/GastosPropietario';
import EstadoCuentaPropietario from './pages/propietario/EstadoCuentaPropietario';
import EstadoCuentaInmueblePropietario from './pages/propietario/EstadoCuentaInmueblePropietario';
import PerfilPropietario from './pages/propietario/PerfilPropietario';
import NotificacionesPropietario from './pages/propietario/NotificacionesPropietario';
import EncuestasPropietario from './pages/propietario/EncuestasPropietario';
import AlquileresPropietario from './pages/propietario/AlquileresPropietario';
import SoporteSuperUsuario from './pages/SoporteSuperUsuario';
import { DialogProvider } from './components/ui/DialogProvider';
import NotFound from './pages/NotFound';
import Error403 from './pages/Error403';
import Error500 from './pages/Error500';
import Error503 from './pages/Error503';

export default function App() {
  return (
    <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cambio-clave-obligatorio" element={<CambioClaveObligatorio />} />
          <Route path="/registro-junta" element={<RegistroJunta />} />
          <Route path="/error-403" element={<Error403 />} />
          <Route path="/error-500" element={<Error500 />} />
          <Route path="/error-503" element={<Error503 />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/perfil" element={<PerfilCondominio />} />
            <Route path="/junta-general" element={<JuntaGeneral />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/cierres" element={<Cierres />} />
            <Route path="/inmuebles" element={<Propiedades />} />
            <Route path="/cuentas-cobrar" element={<CuentasPorCobrar />} />
            <Route path="/bancos" element={<Bancos />} />
            <Route path="/estado-cuentas" element={<EstadoCuentasBancarias />} />
            <Route path="/zonas" element={<Zonas />} />
            <Route path="/alquileres" element={<VistaAlquileres />} />
            <Route path="/carta-consulta" element={<EncuestasAdmin />} />
            <Route path="/avisos-cobro" element={<HistorialAvisos />} />
            <Route path="/aviso-cobro/:id" element={<VistaAvisoCobro />} />
            <Route path="/propietario/gastos" element={<GastosPropietario />} />
            <Route path="/propietario/recibos" element={<RecibosPropietario />} />
            <Route path="/propietario/estado-cuenta" element={<EstadoCuentaPropietario />} />
            <Route path="/propietario/estado-cuenta-inmueble" element={<EstadoCuentaInmueblePropietario />} />
            <Route path="/propietario/alquileres" element={<AlquileresPropietario />} />
            <Route path="/propietario/perfil" element={<PerfilPropietario />} />
            <Route path="/propietario/notificaciones" element={<NotificacionesPropietario />} />
            <Route path="/mis-cartas-consulta" element={<EncuestasPropietario />} />
            <Route path="/soporte/condominios" element={<SoporteSuperUsuario />} />
            {/* Rutas de soporte con condominioId en URL — permite multi-tab y deep links */}
            <Route path="/soporte/:condominioId/dashboard" element={<DashboardHome />} />
            <Route path="/soporte/:condominioId/junta-general" element={<JuntaGeneral />} />
            <Route path="/soporte/:condominioId/perfil" element={<PerfilCondominio />} />
            <Route path="/soporte/:condominioId/proveedores" element={<Proveedores />} />
            <Route path="/soporte/:condominioId/gastos" element={<Gastos />} />
            <Route path="/soporte/:condominioId/cierres" element={<Cierres />} />
            <Route path="/soporte/:condominioId/inmuebles" element={<Propiedades />} />
            <Route path="/soporte/:condominioId/cuentas-cobrar" element={<CuentasPorCobrar />} />
            <Route path="/soporte/:condominioId/bancos" element={<Bancos />} />
            <Route path="/soporte/:condominioId/estado-cuentas" element={<EstadoCuentasBancarias />} />
            <Route path="/soporte/:condominioId/zonas" element={<Zonas />} />
            <Route path="/soporte/:condominioId/avisos-cobro" element={<HistorialAvisos />} />
            <Route path="/soporte/:condominioId/aviso-cobro/:id" element={<VistaAvisoCobro />} />
            <Route path="/soporte/:condominioId/alquileres" element={<VistaAlquileres />} />
            <Route path="/soporte/:condominioId/carta-consulta" element={<EncuestasAdmin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DialogProvider>
  );
}
