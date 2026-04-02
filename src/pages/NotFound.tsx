import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import habiooLogoColor from '../assets/brand/habioo_logo_color.svg';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8faf9] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #00503b 0px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #00503b 0px, transparent 1px, transparent 40px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        <div className="relative w-48 h-48 mb-8">
          <svg
            className="absolute left-0 top-0 w-48 h-48 animate-pulse"
            viewBox="0 0 91.33 92.41"
            style={{
              clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)',
              transform: 'translate(-12px, 8px) rotate(-6deg)',
              opacity: 0.7,
            }}
          >
            <polygon fill="#00503b" points="52.94 40.92 52.94 17.6 65.08 10.58 72.91 15.97 72.91 29.34 72.91 48.56 72.91 48.98 40.47 67.76 40.47 82.47 29.82 82.47 20.51 82.47 9.86 82.47 9.86 65.97 9.9 65.94 9.86 65.93 52.94 40.92"/>
            <polygon fill="#00503b" points="40.47 15.97 32.65 11.51 20.51 18.39 20.51 36.39 9.86 42.55 9.86 59.61 40.47 41.84 40.47 15.97"/>
            <polygon fill="#00503b" points="74.4 53.67 52.94 66.16 52.94 82.47 62.26 82.47 72.91 82.47 82.22 82.47 82.22 58.13 74.4 53.67"/>
          </svg>
          <svg
            className="absolute left-0 top-0 w-48 h-48"
            viewBox="0 0 91.33 92.41"
            style={{
              clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)',
              transform: 'translate(12px, -6px) rotate(5deg)',
              opacity: 0.7,
            }}
          >
            <polygon fill="#00503b" points="52.94 40.92 52.94 17.6 65.08 10.58 72.91 15.97 72.91 29.34 72.91 48.56 72.91 48.98 40.47 67.76 40.47 82.47 29.82 82.47 20.51 82.47 9.86 82.47 9.86 65.97 9.9 65.94 9.86 65.93 52.94 40.92"/>
            <polygon fill="#00503b" points="40.47 15.97 32.65 11.51 20.51 18.39 20.51 36.39 9.86 42.55 9.86 59.61 40.47 41.84 40.47 15.97"/>
            <polygon fill="#00503b" points="74.4 53.67 52.94 66.16 52.94 82.47 62.26 82.47 72.91 82.47 82.22 82.47 82.22 58.13 74.4 53.67"/>
          </svg>
          <svg className="absolute left-1/2 top-0 -translate-x-1/2 w-6 h-48 z-10" viewBox="0 0 24 192">
            <path
              d="M12 0 L14 20 L10 40 L15 65 L9 90 L13 115 L8 140 L14 165 L11 192"
              stroke="#00503b"
              strokeWidth="1.5"
              fill="none"
              opacity="0.3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="text-8xl md:text-9xl font-black text-[#00503b] tracking-tighter leading-none mb-4">404</h1>
        <p className="text-xl md:text-2xl font-semibold text-[#00503b]/80 mb-2">Página no encontrada</p>
        <p className="text-base text-[#00503b]/50 mb-10 max-w-sm">
          La ruta <span className="font-mono bg-[#00503b]/5 px-2 py-0.5 rounded text-sm">{location.pathname}</span> no existe en nuestro sistema.
        </p>

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 bg-[#00503b] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#003d2d] transition-colors shadow-lg shadow-[#00503b]/20"
        >
          Volver atrás
        </button>

        <img src={habiooLogoColor} alt="Habioo" className="mt-16 h-8 opacity-40" />
      </div>
    </div>
  );
};

export default NotFound;
