import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState({ nombre: 'Cargando...', cedula: '' });
  const [userRole, setUserRole] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 1. Logica de Tema y Titulo de Pestana Dinamico
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }

    const titulos = {
      '/dashboard': 'Panel Principal',
      '/proveedores': 'Directorio de Proveedores',
      '/gastos': 'Registro de Gastos',
      '/cierres': 'Cierres y Recibos',
      '/inmuebles': 'Directorio de Inmuebles',
      '/cuentas-cobrar': 'Cuentas por Cobrar'
    };
    document.title = `Habioo | ${titulos[location.pathname] || 'App'}`;
  }, [location]);

  // 2. Autenticacion Centralizada
  useEffect(() => {
    const token = localStorage.getItem('habioo_token');
    if (!token) return navigate('/');

    fetch('https://auth.habioo.cloud/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success') {
          setUser(data.user);
          setUserRole(data.user.cedula.startsWith('J-') ? 'Administrador' : 'Propietario');
        } else {
          localStorage.removeItem('habioo_token');
          navigate('/');
        }
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDarkMode(false);
    } else {
      html.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDarkMode(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('habioo_token');
    navigate('/');
  };

  const navClass = (path) =>
    location.pathname === path
      ? 'text-left font-semibold text-donezo-primary dark:text-donezo-green bg-green-50 dark:bg-green-900/20 p-3 rounded-xl transition-all block'
      : 'text-left font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white p-3 rounded-xl transition-all block';

  return (
    <div className="min-h-screen bg-donezo-bg dark:bg-donezo-dark-bg font-sans flex transition-colors duration-300">
      <aside className="w-64 bg-white dark:bg-donezo-card-dark shadow-lg hidden md:flex flex-col p-6 rounded-r-3xl border-r border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-donezo-primary to-donezo-green rounded-full shadow-md"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Habioo</h2>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <Link to="/dashboard" className={navClass('/dashboard')}>Mi Panel</Link>

          {userRole === 'Administrador' && (
            <>
              <div className="text-xs font-bold text-gray-400 mt-4 mb-2 uppercase tracking-wider">Administracion</div>
              <Link to="/proveedores" className={navClass('/proveedores')}>Proveedores</Link>
              <Link to="/inmuebles" className={navClass('/inmuebles')}>🏠 Inmuebles</Link>
              <Link to="/gastos" className={navClass('/gastos')}>Gastos</Link>
              <Link to="/cuentas-cobrar" className={navClass('/cuentas-cobrar')}>💰 Cuentas por Cobrar</Link>
              <Link to="/cierres" className={navClass('/cierres')}>🔒 Cierres y Recibos</Link>
            </>
          )}
        </nav>

        <button onClick={handleLogout} className="mt-auto text-left font-medium text-red-500 hover:text-red-600 p-3">
          Cerrar Sesion
        </button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto h-screen">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white transition-colors duration-300 capitalize">
              {location.pathname.replace('/', '') || 'Panel'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Hola, <span className="font-semibold text-donezo-green">{user.nombre}</span>
            </p>
          </div>
          <button onClick={toggleDarkMode} className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm text-xl border border-gray-100 dark:border-gray-700">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </header>

        <Outlet context={{ user, userRole }} />
      </main>
    </div>
  );
}
