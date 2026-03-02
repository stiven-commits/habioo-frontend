import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

export default function Proveedores() {
  const { user, userRole } = useOutletContext();
  const [formProv, setFormProv] = useState({
    identificador: '',
    nombre: '',
    telefono1: '',
    telefono2: '',
    direccion: '',
    estado_venezuela: ''
  });
  const formatIdentificador = (val) => {
    let raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!raw) return '';
    const letra = raw.charAt(0);
    const numeros = raw.slice(1);
    if (['V', 'E'].includes(letra)) return numeros.length > 0 ? `${letra}-${numeros}` : letra;
    else if (['J', 'G', 'P'].includes(letra)) {
      if (numeros.length > 8) return `${letra}-${numeros.slice(0, 8)}-${numeros.slice(8, 9)}`;
      else if (numeros.length > 0) return `${letra}-${numeros}`;
      return letra;
    }
    return raw;
  };
  const handleProvChange = (e) => {
    const { name, value } = e.target;
    if (name === 'identificador') {
      setFormProv({ ...formProv, [name]: formatIdentificador(value) });
    } else {
      setFormProv({ ...formProv, [name]: value });
    }
  };

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

  if (userRole !== 'Administrador') {
    return (
      <section className="bg-white dark:bg-donezo-card-dark p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
        <p className="text-gray-600 dark:text-gray-300">{user?.nombre}, no tienes permisos para registrar proveedores.</p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-donezo-card-dark rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Registrar Nuevo Proveedor</h3>
      <form onSubmit={handleRegistrarProveedor} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" name="identificador" value={formProv.identificador} onChange={handleProvChange} placeholder="Identificador (RIF)" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="text" name="nombre" value={formProv.nombre} onChange={handleProvChange} placeholder="Nombre de la Empresa/Persona" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="text" name="telefono1" value={formProv.telefono1} onChange={handleProvChange} placeholder="Teléfono Principal" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <input type="text" name="telefono2" value={formProv.telefono2} onChange={handleProvChange} placeholder="Teléfono Secundario" className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" />
        <textarea name="direccion" value={formProv.direccion} onChange={handleProvChange} placeholder="Dirección" rows="3" className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required />
        <select name="estado_venezuela" value={formProv.estado_venezuela} onChange={handleProvChange} className="md:col-span-2 w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-donezo-green dark:text-white" required>
          <option value="">Seleccione</option>
          <option value="Distrito Capital">Distrito Capital</option>
          <option value="Miranda">Miranda</option>
          <option value="Carabobo">Carabobo</option>
          <option value="Zulia">Zulia</option>
        </select>
        <button type="submit" className="md:col-span-2 w-full p-3 rounded-xl font-semibold bg-donezo-primary text-white hover:opacity-90 transition-all">
          Guardar Proveedor
        </button>
      </form>
    </section>
  );
}
