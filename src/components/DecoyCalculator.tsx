import React, { useState } from 'react';
import { Shield, Sparkles, HelpCircle } from 'lucide-react';

interface DecoyCalculatorProps {
  onTriggerSOS: (reason: string) => void;
  onExitStealth: () => void;
}

export default function DecoyCalculator({ onTriggerSOS, onExitStealth }: DecoyCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isNewNumber, setIsNewNumber] = useState(true);

  // Simple calculator state
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);

  const handleDigit = (digit: string) => {
    if (isNewNumber || display === '0') {
      setDisplay(digit);
      setIsNewNumber(false);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleOperator = (op: string) => {
    const current = parseFloat(display);
    
    // Check for Secret SOS Triggers: e.g. "911" or "777"
    if (display === '911' || display === '777' || display === '999') {
      onTriggerSOS(`Calculator Secret Code: ${display}`);
      setDisplay('Error: Network Timeout');
      setIsNewNumber(true);
      return;
    }

    setPrevVal(current);
    setOperation(op);
    setEquation(`${current} ${op}`);
    setIsNewNumber(true);
  };

  const handleEqual = () => {
    if (!operation || prevVal === null) {
      // Check if current display triggers SOS
      if (display === '911' || display === '777' || display === '999') {
        onTriggerSOS(`Calculator Secret Code: ${display}`);
        setDisplay('Emergency Signal Transmitted');
        setIsNewNumber(true);
        return;
      }
      return;
    }

    const current = parseFloat(display);
    let result = 0;

    switch (operation) {
      case '+':
        result = prevVal + current;
        break;
      case '-':
        result = prevVal - current;
        break;
      case '×':
        result = prevVal * current;
        break;
      case '÷':
        result = current !== 0 ? prevVal / current : NaN;
        break;
      default:
        return;
    }

    setEquation(`${equation} ${current} =`);
    setDisplay(String(Number(result.toFixed(8))));
    setPrevVal(null);
    setOperation(null);
    setIsNewNumber(true);

    // If result is 911, trigger SOS too
    if (result === 911 || result === 999) {
      onTriggerSOS(`Calculator Equation Result: ${result}`);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setPrevVal(null);
    setOperation(null);
    setIsNewNumber(true);
  };

  const handlePercent = () => {
    const current = parseFloat(display);
    setDisplay(String(current / 100));
    setIsNewNumber(true);
  };

  const handleToggleSign = () => {
    const current = parseFloat(display);
    setDisplay(String(current * -1));
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-slate-950 rounded-3xl border border-slate-850 shadow-2xl overflow-hidden font-sans">
      {/* Header Decoy bar with exit trigger */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div 
          className="flex items-center space-x-1.5 cursor-pointer select-none"
          onDoubleClick={onExitStealth}
          title="Double-click to exit stealth mode"
        >
          <Sparkles className="w-4 h-4 text-amber-500/80 animate-pulse" />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-widest font-display">
            NovaCalc Elite v4.1
          </span>
        </div>
        <button 
          onClick={onExitStealth}
          className="p-1.5 hover:bg-slate-900 rounded-full text-slate-600 hover:text-slate-400 transition"
          title="Return to Safety Center"
        >
          <Shield className="w-4 h-4" />
        </button>
      </div>

      {/* Screen */}
      <div className="mb-6 px-4 py-6 bg-slate-900/55 rounded-2xl border border-slate-900 flex flex-col justify-end items-end h-32 select-all font-mono">
        <div className="text-sm text-slate-500 h-5 mb-1 overflow-x-auto whitespace-nowrap w-full text-right">
          {equation}
        </div>
        <div className="text-4xl font-semibold text-slate-100 overflow-x-auto whitespace-nowrap w-full text-right">
          {display}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* Row 1 */}
        <button onClick={handleClear} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900 text-amber-500 hover:bg-slate-850 active:scale-95">
          AC
        </button>
        <button onClick={handleToggleSign} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900 text-slate-300 hover:bg-slate-850 active:scale-95">
          +/-
        </button>
        <button onClick={handlePercent} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900 text-slate-300 hover:bg-slate-850 active:scale-95">
          %
        </button>
        <button onClick={() => handleOperator('÷')} className="h-14 rounded-2xl font-semibold text-xl transition bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95">
          ÷
        </button>

        {/* Row 2 */}
        <button onClick={() => handleDigit('7')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          7
        </button>
        <button onClick={() => handleDigit('8')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          8
        </button>
        <button onClick={() => handleDigit('9')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          9
        </button>
        <button onClick={() => handleOperator('×')} className="h-14 rounded-2xl font-semibold text-xl transition bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95">
          ×
        </button>

        {/* Row 3 */}
        <button onClick={() => handleDigit('4')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          4
        </button>
        <button onClick={() => handleDigit('5')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          5
        </button>
        <button onClick={() => handleDigit('6')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          6
        </button>
        <button onClick={() => handleOperator('-')} className="h-14 rounded-2xl font-semibold text-2xl transition bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95">
          -
        </button>

        {/* Row 4 */}
        <button onClick={() => handleDigit('1')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          1
        </button>
        <button onClick={() => handleDigit('2')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          2
        </button>
        <button onClick={() => handleDigit('3')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          3
        </button>
        <button onClick={() => handleOperator('+')} className="h-14 rounded-2xl font-semibold text-xl transition bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95">
          +
        </button>

        {/* Row 5 */}
        <button onClick={() => handleDigit('0')} className="col-span-2 h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 text-left px-6 active:scale-95">
          0
        </button>
        <button onClick={() => handleDigit('.')} className="h-14 rounded-2xl font-semibold text-lg transition bg-slate-900/40 text-slate-200 hover:bg-slate-850 active:scale-95">
          .
        </button>
        <button onClick={handleEqual} className="h-14 rounded-2xl font-semibold text-2xl transition bg-amber-600 text-slate-50 hover:bg-amber-500 active:scale-95">
          =
        </button>
      </div>

      {/* Discretization instructions */}
      <div className="mt-5 text-center text-[10px] text-slate-600 leading-relaxed max-w-[280px] mx-auto select-none">
        NovaCalc processes basic floating point precision calculations safely.<br />
        <span className="opacity-50 font-display">Double-tap top-left brand header to restore management panel.</span>
      </div>
    </div>
  );
}
