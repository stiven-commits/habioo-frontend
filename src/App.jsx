import { useState } from 'react';
// Usamos BrowserRouter para rutas limpias
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';

// Componente del Login
function Login() {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // Hook para cambiar de pÃ¡gina

  const formatIdentificador = (val) => {
    // 1. Limpiamos: Solo dejamos letras y números, y pasamos a mayúscula
    let raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!raw) return '';

    const letra = raw.charAt(0);
    const numeros = raw.slice(1);

    // 2. Si es persona natural (V, E) -> Lleva 1 solo guion
    if (['V', 'E'].includes(letra)) {
      return numeros.length > 0 ? `${letra}-${numeros}` : letra;
    } 
    // 3. Si es Jurídico (J, G, P) -> Lleva 2 guiones (ej: J-12345678-9)
    else if (['J', 'G', 'P'].includes(letra)) {
      if (numeros.length > 8) {
        // Separa los primeros 8 números, pone guion, y luego el último dígito
        return `${letra}-${numeros.slice(0, 8)}-${numeros.slice(8, 9)}`;
      } else if (numeros.length > 0) {
        return `${letra}-${numeros}`;
      }
      return letra;
    }
    
    // Si empieza con otra letra no contemplada, lo devuelve normal
    return raw;
  };
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('Conectando al servidor...');

    try {
      const response = await fetch('https://auth.habioo.cloud/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, password })
      });
      
      const data = await response.json();

      if (data.status === 'success') {
        localStorage.setItem('habioo_token', data.token);
        // Â¡Magia! Si el login es exitoso, lo enviamos al dashboard
        navigate('/dashboard'); 
      } else {
        setMessage('âŒ Error: ' + data.message);
      }
    } catch (error) {
      setMessage('âŒ Error de conexiÃ³n con el servidor.');
    }
  }

  return (
    <div className="min-h-screen bg-donezo-bg dark:bg-donezo-dark-bg flex items-center justify-center p-4">
      <div className="bg-white dark:bg-donezo-card-dark p-8 rounded-3xl shadow-xl w-full max-w-md transition-colors">
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-gradient-to-br from-donezo-primary to-donezo-green rounded-2xl shadow-lg mb-4 transform rotate-3"></div>
           <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Portal Habioo</h1>
           <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">Ingresa para ver tus recibos de condominio.</p>
        </div>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Identificador (Cédula o RIF):</label>
            <input 
              type="text" 
              placeholder="Ej: V-12345678 o J-12345678-9"
              value={cedula} 
              onChange={e => setCedula(formatIdentificador(e.target.value))} 
              required 
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-donezo-green outline-none transition-all dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contraseña:</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-donezo-green outline-none transition-all dark:text-white"
            />
          </div>

          <button 
            type="submit" 
            className="w-full p-3 mt-2 bg-gradient-to-r from-donezo-primary to-donezo-green hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-md transform hover:-translate-y-1"
          >
            Entrar al Sistema
          </button>
        </form>

        {message && <p className="mt-4 text-center font-semibold text-red-500">{message}</p>}
      </div>
    </div>
  );
}

// El Enrutador Principal
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}



