import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { sanitizeCedulaRif, isValidCedulaRif } from '../utils/validators';

export default function Login() {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // FunciÃ³n Limpia: Solo permite letras y nÃºmeros (Sin guiones)
  const handleCedulaChange = (e) => {
    setCedula(sanitizeCedulaRif(e.target.value));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isValidCedulaRif(cedula)) {
      setMessage('Error: el identificador debe iniciar con V, E, J o G y contener solo números.');
      return;
    }
    setMessage('Conectando...');

    try {
      const response = await fetch(API_BASE_URL + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, password })
      });

      const data = await response.json();

      if (data.status === 'success') {
        localStorage.setItem('habioo_token', data.token);
        // Guardamos datos del usuario para usarlos en el Dashboard
        localStorage.setItem('habioo_user', JSON.stringify(data.user)); 
        navigate('/dashboard');
      } else {
        setMessage('Error: ' + data.message);
      }
    } catch (error) {
      setMessage('Error de conexiÃ³n con el servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-donezo-card-dark p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-donezo-primary to-donezo-green rounded-2xl shadow-lg mb-4 transform rotate-3"></div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Portal Habioo</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">GestiÃ³n de Condominios</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Identificador</label>
            <input
              type="text"
              placeholder="Ej: V12345678 (Sin guiones)"
              value={cedula}
              onChange={handleCedulaChange}
              pattern="^[VEJG][0-9]{5,9}$"
              required
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-donezo-green outline-none transition-all dark:text-white font-bold tracking-wider"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">ContraseÃ±a</label>
            <input
              type="password"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-donezo-green outline-none transition-all dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full p-4 mt-2 bg-gradient-to-r from-donezo-primary to-donezo-green hover:opacity-90 text-white font-bold rounded-xl transition-all shadow-lg transform hover:-translate-y-1"
          >
            Entrar al Sistema
          </button>
        </form>

        {message && <p className="mt-4 text-center font-bold text-red-500 animate-pulse">{message}</p>}
      </div>
    </div>
  );
}
