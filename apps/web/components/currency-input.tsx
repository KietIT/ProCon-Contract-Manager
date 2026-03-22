'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type Currency = 'USD' | 'VND';

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'VND', label: 'VND', symbol: '₫' },
];

interface CurrencyInputProps {
  value: string;
  currency: Currency;
  onChange: (value: string, currency: Currency) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function CurrencyInput({
  value,
  currency,
  onChange,
  placeholder,
  disabled = false,
  className = '',
}: CurrencyInputProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = CURRENCIES.find(c => c.value === currency) ?? CURRENCIES[0];
  const defaultPlaceholder = currency === 'VND' ? 'e.g. 35,000,000' : 'e.g. 1,500,000';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleCurrencySelect(c: Currency) {
    setOpen(false);
    onChange(value, c);
  }

  return (
    <div className={`flex w-full rounded-lg border border-app-border bg-sidebar-alt focus-within:border-accent-cyan/50 focus-within:ring-1 focus-within:ring-accent-cyan/20 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {/* Currency selector */}
      <div className="relative flex-shrink-0" ref={dropdownRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(prev => !prev)}
          className="flex items-center gap-1.5 h-full px-3 border-r border-app-border text-sm font-semibold text-app-text hover:text-app-text transition-colors rounded-l-lg"
        >
          <span>{selected.symbol}</span>
          <span>{selected.label}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-app-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-sidebar-bg border border-app-border rounded-lg shadow-xl overflow-hidden min-w-[100px]">
            {CURRENCIES.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleCurrencySelect(c.value)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-sidebar-alt transition-colors"
              >
                <span className="flex items-center gap-2 text-app-text">
                  <span className="text-app-text-muted">{c.symbol}</span>
                  {c.label}
                </span>
                {c.value === currency && <Check className="w-3.5 h-3.5 text-accent-cyan" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount input */}
      <input
        type="text"
        inputMode="numeric"
        value={value ? Number(value).toLocaleString('en-US') : ''}
        disabled={disabled}
        onChange={e => {
          const raw = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
          onChange(raw, currency);
        }}
        placeholder={placeholder ?? defaultPlaceholder}
        className="flex-1 px-4 py-2.5 bg-transparent text-app-text text-sm placeholder-app-text-muted focus:outline-none rounded-r-lg"
      />
    </div>
  );
}
