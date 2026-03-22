'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(true);

  // On mount, read saved preference (default: light)
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const light = saved !== 'dark';
    setIsLight(light);
    document.documentElement.classList.toggle('light', light);
  }, []);

  const toggle = () => {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle('light', next);
    localStorage.setItem('theme', next ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
    >
      {isLight
        ? <Moon className="w-5 h-5" />
        : <Sun  className="w-5 h-5" />
      }
    </button>
  );
}
