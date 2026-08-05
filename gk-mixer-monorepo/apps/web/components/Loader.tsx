import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const Loader: React.FC<LoaderProps> = ({ size = 'md', color }) => {
  const sizeMap = {
    sm: '12px',
    md: '16px',
    lg: '20px'
  };

  const fontSize = sizeMap[size];

  return (
    <div 
      className="loader-wrapper"
      style={{ 
        fontSize,
        '--loader-color': color || 'var(--macaron-blue, #7dd3fc)'
      } as React.CSSProperties}
    >
      <div className="loader" />
      <style>{`
        .loader-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .loader-wrapper .loader {
          position: relative;
          width: 5.5em;
          height: 5.5em;
        }

        .loader-wrapper .loader:before {
          content: '';
          position: absolute;
          transform: translate(-50%, -50%) rotate(45deg);
          height: 100%;
          width: 4px;
          background: currentColor;
          opacity: 0.3;
          left: 50%;
          top: 50%;
          border-radius: 2px;
        }

        .loader-wrapper .loader:after {
          content: '';
          position: absolute;
          left: 0.2em;
          bottom: 0.18em;
          width: 1em;
          height: 1em;
          background-color: var(--loader-color);
          border-radius: 15%;
          animation: rollingRock 2.5s cubic-bezier(.79, 0, .47, .97) infinite;
          box-shadow: 0 2px 8px var(--loader-color);
        }

        @keyframes rollingRock {
          0% {
            transform: translate(0, -1em) rotate(-45deg)
          }

          5% {
            transform: translate(0, -1em) rotate(-50deg)
          }

          20% {
            transform: translate(1em, -2em) rotate(47deg)
          }

          25% {
            transform: translate(1em, -2em) rotate(45deg)
          }

          30% {
            transform: translate(1em, -2em) rotate(40deg)
          }

          45% {
            transform: translate(2em, -3em) rotate(137deg)
          }

          50% {
            transform: translate(2em, -3em) rotate(135deg)
          }

          55% {
            transform: translate(2em, -3em) rotate(130deg)
          }

          70% {
            transform: translate(3em, -4em) rotate(217deg)
          }

          75% {
            transform: translate(3em, -4em) rotate(220deg)
          }

          100% {
            transform: translate(0, -1em) rotate(-225deg)
          }
        }
      `}</style>
    </div>
  );
};

export default Loader;
