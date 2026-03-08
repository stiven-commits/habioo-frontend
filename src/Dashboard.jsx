import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from './utils/currency';

export default function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Cargando...');
  const [propiedades, setPropiedades] = useState([]);
  const [finanzas, setFinanzas] = useState({ deuda_actual: 0, total_pagado: 0, recibos_pendientes: 0 });
  const [userRole, setUserRole] = useState('');
  const [userIdentificador, setUserIdentificador] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [formProv, setFormProv] = useState({ identificador: '', nombre: '', telefono1: '', telefono2: '', direccion: '', estado_venezuela: '' });
  const [formGasto, setFormGasto] = useState({ proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: 1, periodo_cobro: '' });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }

    const token = localStorage.getItem('habioo_token');
    if (!token) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        const resUser = await fetch('https://auth.habioo.cloud/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataUser = await resUser.json();

        if (dataUser.status === 'success') {
          setUserName(dataUser.user.nombre);
          setUserIdentificador(dataUser.user.cedula);

          if (dataUser.user.cedula.startsWith('J-')) {
            setUserRole('Administrador');

            const resProveedores = await fetch('https://auth.habioo.cloud/proveedores', {
              headers: { Authorization: `Bearer ${token}` }
            });
            const dataProveedores = await resProveedores.json();
            if (dataProveedores.status === 'success') {
              setProveedores(dataProveedores.proveedores);
            }
          } else {
            setUserRole('Propietario');
          }
        } else {
          localStorage.removeItem('habioo_token');
          navigate('/');
          return;
        }

        const resProps = await fetch('https://auth.habioo.cloud/mis-propiedades', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataProps = await resProps.json();

        if (dataProps.status === 'success') {
          setPropiedades(dataProps.propiedades);
        }

        const resFinanzas = await fetch('https://auth.habioo.cloud/mis-finanzas', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const dataFinanzas = await resFinanzas.json();

        if (dataFinanzas.status === 'success') {
          setFinanzas(dataFinanzas.finanzas);
        }
      } catch (error) {
        console.error('Error conectando con el servidor:', error);
      }
    };

    fetchData();
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

  const handleProvChange = (e) => setFormProv({ ...formProv, [e.target.name]: e.target.value });
  const handleGastoChange = (e) => setFormGasto({ ...formGasto, [e.target.name]: e.target.value });

  const handleRegistrarProveedor = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch('https://auth.habioo.cloud/proveedores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formProv)
      });

      const data = await response.json();

      if (data.status === 'success') {
        alert('Proveedor registrado con éxito');
        setFormProv({ identificador: '', nombre: '', telefono1: '', telefono2: '', direccion: '', estado_venezuela: '' });
      } else {
        alert(data.message || 'Error al registrar proveedor');
      }
    } catch (error) {
      alert('Error de conexión al registrar proveedor');
    }
  };

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('habioo_token');
      const response = await fetch('https://auth.habioo.cloud/gastos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formGasto)
      });

      const data = await response.json();

      if (data.status === 'success') {
        alert(data.message || 'Gasto registrado con éxito');
        setFormGasto({ proveedor_id: '', concepto: '', monto_bs: '', tasa_cambio: '', total_cuotas: 1, periodo_cobro: '' });
      } else {
        alert(data.message || 'Error al registrar gasto');
      }
    } catch (error) {
      alert('Error de conexión al registrar gasto');
    }
  };

  const montoBsNum = parseFloat(formGasto.monto_bs);
  const tasaCambioNum = parseFloat(formGasto.tasa_cambio);
  const totalCuotasNum = parseInt(formGasto.total_cuotas, 10);
  const canCalcUsd = Number.isFinite(montoBsNum) && Number.isFinite(tasaCambioNum) && tasaCambioNum > 0;
  const totalUsdCalc = canCalcUsd ? (montoBsNum / tasaCambioNum).toFixed(2) : null;
  const cuotaUsdCalc = canCalcUsd && Number.isFinite(totalCuotasNum) && totalCuotasNum > 0
    ? (montoBsNum / tasaCambioNum / totalCuotasNum).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-donezo-bg dark:bg-donezo-dark-bg font-sans flex transition-colors duration-300">
      <aside className="w-64 bg-white dark:bg-donezo-card-dark shadow-lg hidden md:flex flex-col p-6 rounded-r-3xl border-r border-gray-100 dark:border-gray-800 transition-colors duration-300">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-donezo-primary to-donezo-green rounded-full shadow-md"></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Habioo</h2>
        </div>
        <nav className="flex flex-col gap-4 flex-1">
          <button className="text-left font-semibold text-donezo-primary dark:text-donezo-green bg-green-50 dark:bg-green-900/20 p-3 rounded-xl transition-all">
            Mi Panel
          </button>
          <button className="text-left font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white p-3 rounded-xl transition-all">
            Mis Recibos
          </button>
        </nav>
        <button onClick={handleLogout} className="mt-auto text-left font-medium text-red-500 hover:text-red-600 p-3">
          Cerrar Sesion
        </button>
      </aside>

      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white transition-colors duration-300">Panel de {userRole || 'Usuario'}</h1>
            <p className="text-gray-500 dark:text-gray-400 transition-colors duration-300">
              Hola, <span className="font-semibold text-donezo-green">{userName}</span>
            </p>
            {userIdentificador && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{userIdentificador}</p>
            )}
          </div>
          <button onClick={toggleDarkMode} className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm text-xl border border-gray-100 dark:border-gray-700">
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </header>

        {userRole === 'Propietario' ? (
          <>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Mis Propiedades</h2>
            {propiedades.length === 0 ? (
              <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-yellow-200 dark:border-yellow-900 mb-8">
                <p className="text-gray-600 dark:text-gray-300">Aun no tienes propiedades vinculadas a tu cedula. Si eres propietario, contacta a tu Junta de Condominio.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {propiedades.map((prop, index) => (
                  <div key={index} className="bg-gradient-to-br from-donezo-primary to-donezo-green p-6 rounded-3xl shadow-lg text-white transform hover:scale-105 transition-transform">
                    <div className="text-sm bg-white/20 inline-block px-3 py-1 rounded-full mb-3">
                      {prop.rol}
                    </div>
                    <h3 className="text-2xl font-bold">{prop.identificador}</h3>
                    <p className="opacity-90">{prop.condominio_nombre}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : userRole === 'Administrador' ? (
          <div className="mb-8 rounded-3xl border border-orange-200 dark:border-orange-900 bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 p-6 shadow-sm">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-5">🔥 Modo Administración Activo</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="w-full p-4 rounded-2xl font-semibold bg-donezo-primary text-white hover:opacity-90 transition-all">
                Emitir Gasto/Recibo
              </button>
              <button className="w-full p-4 rounded-2xl font-semibold bg-donezo-green text-white hover:opacity-90 transition-all">
                Ver Juntas Anexadas
              </button>
              <button className="w-full p-4 rounded-2xl font-semibold bg-orange-500 text-white hover:opacity-90 transition-all">
                Registrar Pagos
              </button>
            </div>

            <div className="mt-6 bg-white dark:bg-donezo-card-dark rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">🏢 Registrar Nuevo Proveedor</h3>
              <form onSubmit={handleRegistrarProveedor} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="identificador"
                  value={formProv.identificador}
                  onChange={handleProvChange}
                  placeholder="Identificador (RIF)"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="text"
                  name="nombre"
                  value={formProv.nombre}
                  onChange={handleProvChange}
                  placeholder="Nombre de la Empresa/Persona"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="text"
                  name="telefono1"
                  value={formProv.telefono1}
                  onChange={handleProvChange}
                  placeholder="Teléfono Principal"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="text"
                  name="telefono2"
                  value={formProv.telefono2}
                  onChange={handleProvChange}
                  placeholder="Teléfono Secundario"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                />
                <textarea
                  name="direccion"
                  value={formProv.direccion}
                  onChange={handleProvChange}
                  placeholder="Dirección"
                  rows="3"
                  className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <select
                  name="estado_venezuela"
                  value={formProv.estado_venezuela}
                  onChange={handleProvChange}
                  className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                >
                  <option value="">Seleccione</option>
                  <option value="Distrito Capital">Distrito Capital</option>
                  <option value="Miranda">Miranda</option>
                  <option value="Carabobo">Carabobo</option>
                  <option value="Zulia">Zulia</option>
                </select>
                <button
                  type="submit"
                  className="md:col-span-2 w-full p-3 rounded-xl font-semibold bg-donezo-primary text-white hover:opacity-90 transition-all"
                >
                  Guardar Proveedor
                </button>
              </form>
            </div>

            <div className="mt-6 bg-white dark:bg-donezo-card-dark rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">💸 Registrar Gasto</h3>
              <form onSubmit={handleRegistrarGasto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  name="proveedor_id"
                  value={formGasto.proveedor_id}
                  onChange={handleGastoChange}
                  className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                >
                  <option value="">Seleccione Proveedor</option>
                  {proveedores.map((prov) => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
                <input
                  type="text"
                  name="concepto"
                  value={formGasto.concepto}
                  onChange={handleGastoChange}
                  placeholder="Concepto"
                  className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="monto_bs"
                  value={formGasto.monto_bs}
                  onChange={handleGastoChange}
                  placeholder="Monto (Bs)"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  name="tasa_cambio"
                  value={formGasto.tasa_cambio}
                  onChange={handleGastoChange}
                  placeholder="Tasa de Cambio (Bs/$)"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="number"
                  min="1"
                  name="total_cuotas"
                  value={formGasto.total_cuotas}
                  onChange={handleGastoChange}
                  placeholder="Total Cuotas"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />
                <input
                  type="text"
                  name="periodo_cobro"
                  value={formGasto.periodo_cobro}
                  onChange={handleGastoChange}
                  placeholder="Periodo de Cobro (Ej: Cierre 1)"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white"
                  required
                />

                <div className="md:col-span-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Total en USD: <span className="font-bold">{totalUsdCalc ? `$${formatMoney(totalUsdCalc)}` : '--'}</span>
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Monto por Cuota en USD: <span className="font-bold">{cuotaUsdCalc ? `$${formatMoney(cuotaUsdCalc)}` : '--'}</span>
                  </p>
                </div>

                <button
                  type="submit"
                  className="md:col-span-2 w-full p-3 rounded-xl font-semibold bg-orange-500 text-white hover:opacity-90 transition-all"
                >
                  Guardar Gasto
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-donezo-green to-emerald-600 text-white p-6 rounded-3xl shadow-lg">
            <p className="text-sm opacity-90 mb-2">Total Pagado</p>
            <h3 className="text-3xl font-bold">${formatMoney(finanzas.total_pagado)}</h3>
          </div>
          <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Mi Deuda Actual</p>
            <h3 className="text-3xl font-bold text-gray-800 dark:text-white">${formatMoney(finanzas.deuda_actual)}</h3>
          </div>
          <div className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Recibos Pendientes</p>
            <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{finanzas.recibos_pendientes}</h3>
          </div>
        </section>
      </main>
    </div>
  );
}

