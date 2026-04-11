import type { FC } from 'react';

interface HabiooLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  message?: string;
  fullscreen?: boolean;
  className?: string;
}

const sizeMap: Record<NonNullable<HabiooLoaderProps['size']>, string> = {
  xs: 'h-6 w-6',
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
};

const logoSizeMap: Record<NonNullable<HabiooLoaderProps['size']>, string> = {
  xs: 'h-3 w-3',
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

const HabiooLoader: FC<HabiooLoaderProps> = ({
  size = 'sm',
  message = 'Cargando...',
  fullscreen = false,
  className = '',
}) => {
  const wrapper = fullscreen
    ? 'fixed inset-0 z-[9999] bg-white/90 dark:bg-[#0f111a]/90 backdrop-blur-sm'
    : '';

  return (
    <div className={`${wrapper} flex flex-col items-center justify-center gap-3 py-10 ${className}`}>
      <style>{`
        @keyframes habioo-pulse-logo {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.85); opacity: 0.6; }
        }
      `}</style>
      <div className="relative flex items-center justify-center">
        <div className={`absolute rounded-full border-[3px] border-transparent border-t-donezo-primary animate-spin ${sizeMap[size]}`} />
        <svg
          className={logoSizeMap[size]}
          style={{ animation: 'habioo-pulse-logo 1.2s ease-in-out infinite' }}
          viewBox="0 0 91.33 92.41"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Habioo"
          role="img"
        >
          <polygon fill="currentColor" className="text-donezo-primary" points="52.94 40.92 52.94 17.6 65.08 10.58 72.91 15.97 72.91 29.34 72.91 48.56 72.91 48.98 40.47 67.76 40.47 82.47 29.82 82.47 20.51 82.47 9.86 82.47 9.86 65.97 9.9 65.94 9.86 65.93 52.94 40.92" />
          <polygon fill="currentColor" className="text-donezo-primary" points="40.47 15.97 32.65 11.51 20.51 18.39 20.51 36.39 9.86 42.55 9.86 59.61 40.47 41.84 40.47 15.97" />
          <polygon fill="currentColor" className="text-donezo-primary" points="74.4 53.67 52.94 66.16 52.94 82.47 62.26 82.47 72.91 82.47 82.22 82.47 82.22 58.13 74.4 53.67" />
        </svg>
      </div>
      {Boolean(message) && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 animate-pulse">{message}</p>}
    </div>
  );
};

export default HabiooLoader;
