import React, { useState, useEffect, useRef } from 'react';
import { Panel } from '../../components/ui/Panel';

interface Symbol {
  key: string;
  name: string;
  price: number;
  open: number;
  history: number[];
}

const INITIAL_SYMBOLS: Omit<Symbol, 'history' | 'open'>[] = [
  { key: 'NIFTY',     name: 'NIFTY 50',    price: 25848.30 },
  { key: 'SENSEX',    name: 'SENSEX',      price: 84912.60 },
  { key: 'BANKNIFTY', name: 'BANK NIFTY',  price: 55307.15 },
  { key: 'VIX',       name: 'INDIA VIX',   price: 13.22    },
];

function initSymbols(): Symbol[] {
  return INITIAL_SYMBOLS.map((s) => ({
    ...s,
    open: s.price,
    history: Array.from({ length: 30 }, () => s.price),
  }));
}

function Sparkline({ history, up }: { history: number[]; up: boolean }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = (max - min) || 1;
  const pts = history
    .map((v, i) => `${(i / (history.length - 1)) * 100},${34 - ((v - min) / range) * 30 - 2}`)
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? '#33D17A' : '#FF4D5E'}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TickerCard({ sym }: { sym: Symbol }) {
  const change = sym.price - sym.open;
  const pct = (change / sym.open) * 100;
  const up = change >= 0;

  return (
    <div className="ticker-card panel">
      <div className="ticker-top">
        <span className="ticker-name">{sym.name}</span>
        <span className="badge-sim">SIMULATED</span>
      </div>
      <div className={`ticker-price mono`} id={`price-${sym.key}`}>{sym.price.toFixed(2)}</div>
      <div className={`ticker-change mono ${up ? 'up' : 'down'}`} id={`chg-${sym.key}`}>
        {up ? '+' : ''}{change.toFixed(2)} ({up ? '+' : ''}{pct.toFixed(2)}%)
      </div>
      <Sparkline history={sym.history} up={up} />
    </div>
  );
}

export function TickerGrid() {
  const [symbols, setSymbols] = useState<Symbol[]>(initSymbols);

  useEffect(() => {
    const id = setInterval(() => {
      setSymbols((prev) =>
        prev.map((s) => {
          const vol = s.key === 'VIX' ? 0.06 : s.price * 0.0009;
          const price = Math.max(0.5, s.price + (Math.random() - 0.5) * vol * 2);
          const history = [...s.history.slice(-29), price];
          return { ...s, price, history };
        }),
      );
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ticker-grid" id="tickerGrid">
      {symbols.map((s) => <TickerCard key={s.key} sym={s} />)}
    </div>
  );
}
