import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [theme, setTheme] = useState(localStorage.theme || 'light');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('habioo_token');
    const userData = localStorage.getItem('habioo_user');
    if (!token || !userData) { navigate('/'); return; }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    const isAdmin = ['J', 'G'].includes(parsedUser.cedula.charAt(0).toUpperCase());
    setUserRole(isAdmin ? 'Administrador' : 'Residente');
  }, [navigate]);

  // Lógica de Tema
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const pageTitles = {
    '/dashboard': 'Panel Principal',
    '/proveedores': 'Directorio de Proveedores',
    '/gastos': 'Gastos Comunes',
    '/cierres': 'Cierres y Recibos',
    '/inmuebles': 'Directorio de Inmuebles',
    '/cuentas-cobrar': 'Cuentas por Cobrar',
    '/bancos': 'Cuentas Bancarias',
    '/zonas': 'Áreas / Sectores'
  };

  const navClass = (path) => `block py-3 px-4 rounded-xl transition-all duration-200 font-medium ${
      location.pathname === path 
        ? 'bg-donezo-primary text-white shadow-lg shadow-green-500/30' 
        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
    }`;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f111a] transition-colors duration-300 flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-[#161b22] border-r border-gray-100 dark:border-gray-800 hidden md:flex flex-col fixed h-full z-20">
        <div className="p-8"><h1 className="text-2xl font-bold bg-gradient-to-r from-donezo-primary to-green-400 bg-clip-text text-transparent">Habioo</h1></div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <Link to="/dashboard" className={navClass('/dashboard')}>📊 Dashboard</Link>
          {userRole === 'Administrador' && (
            <>
              <p className="px-4 text-xs font-bold text-gray-400 uppercase mt-6 mb-2">Configuración</p>
              <Link to="/bancos" className={navClass('/bancos')}>💳 Cuentas Bancarias</Link>
              <Link to="/zonas" className={navClass('/zonas')}>🏢 Áreas / Sectores</Link>
              <Link to="/inmuebles" className={navClass('/inmuebles')}>🏠 Inmuebles</Link>
              <Link to="/proveedores" className={navClass('/proveedores')}>🤝 Proveedores</Link>
              <p className="px-4 text-xs font-bold text-gray-400 uppercase mt-6 mb-2">Contabilidad</p>
              <Link to="/gastos" className={navClass('/gastos')}>🧾 Gastos</Link>
              <Link to="/cierres" className={navClass('/cierres')}>🔒 Cierres Preliminares</Link>
              <Link to="/historial-recibos" className={navClass('/historial-recibos')}>🗂️ Historial Recibos</Link>
              <Link to="/cuentas-cobrar" className={navClass('/cuentas-cobrar')}>💰 Cobranza</Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 w-full p-2 rounded-lg dark:text-gray-400"><span>🚪</span> Salir</button>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{pageTitles[location.pathname] || 'Bienvenido'}</h2>
            <p className="text-gray-500 text-sm dark:text-gray-400">Hola, {user.nombre}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* BOTÓN TEMA */}
            <button onClick={toggleTheme} className="p-3 rounded-xl bg-white dark:bg-[#161b22] border border-gray-100 dark:border-gray-800 shadow-sm text-xl transition-transform active:scale-90">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="w-10 h-10 rounded-full bg-donezo-primary flex items-center justify-center text-white font-bold">{user.nombre.charAt(0)}</div>
          </div>
        </header>
        <Outlet context={{ user, userRole }} />
      </main>
    </div>
  );
}