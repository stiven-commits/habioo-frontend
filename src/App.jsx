import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login'; // <--- Importamos el archivo nuevo
import DashboardHome from './pages/DashboardHome';
import Proveedores from './pages/Proveedores';
import Gastos from './pages/Gastos';
import Cierres from './pages/Cierres';
import Propiedades from './pages/Propiedades';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import Bancos from './pages/Bancos';
import Zonas from './pages/Zonas';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública del Login */}
        <Route path="/" element={<Login />} />

        {/* Rutas protegidas con el Layout (Menú lateral) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/cierres" element={<Cierres />} />
          <Route path="/inmuebles" element={<Propiedades />} />
          <Route path="/cuentas-cobrar" element={<CuentasPorCobrar />} />
          <Route path="/bancos" element={<Bancos />} />
          <Route path="/zonas" element={<Zonas />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}