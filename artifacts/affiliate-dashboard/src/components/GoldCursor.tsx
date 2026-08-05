import { useEffect, useRef } from 'react';

export default function GoldCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`;
        cursorRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <>
      <style>{`* { cursor: none !important; }`}</style>
      <div
        ref={cursorRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 99999,
          left: -300,
          top: -300,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="26"
          viewBox="0 0 22 26"
          style={{ display: 'block', filter: 'drop-shadow(0 1px 4px rgba(200,140,0,0.5))' }}
        >
          <polygon
            points="0,0 0,20 5,15 9,24 12,23 8,14 14,14"
            fill="#FACC15"
            stroke="#A37C00"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}
