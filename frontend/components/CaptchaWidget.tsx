import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface CaptchaWidgetProps {
  onVerify: (isValid: boolean) => void;
  resetKey?: number; // increment this to force a reset
}

interface Challenge {
  a: number;
  b: number;
  op: '+' | '-' | '×';
  answer: number;
}

const OPERATORS: Array<'+' | '-' | '×'> = ['+', '-', '×'];
const DISTORTION_CHARS = '!@#$%^&*~`';

function generateChallenge(): Challenge {
  const op = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
  let a: number, b: number, answer: number;

  if (op === '+') {
    a = Math.floor(Math.random() * 15) + 2;
    b = Math.floor(Math.random() * 15) + 2;
    answer = a + b;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 15) + 10;
    b = Math.floor(Math.random() * (a - 1)) + 1;
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    answer = a * b;
  }

  return { a, b, op, answer };
}

/** Renders the CAPTCHA challenge as an SVG with noise/distortion */
function CaptchaCanvas({ challenge }: { challenge: Challenge }) {
  const label = `${challenge.a} ${challenge.op} ${challenge.b} = ?`;
  const width = 200;
  const height = 48;

  // Generate decorative noise lines
  const noiseLines = Array.from({ length: 6 }, (_, i) => {
    const x1 = Math.abs(Math.sin(i * 37.4)) * width;
    const y1 = Math.abs(Math.cos(i * 19.1)) * height;
    const x2 = Math.abs(Math.sin(i * 47.8 + 1)) * width;
    const y2 = Math.abs(Math.cos(i * 23.7 + 2)) * height;
    return { x1, y1, x2, y2 };
  });

  // Generate scattered dot noise
  const noiseDots = Array.from({ length: 20 }, (_, i) => ({
    cx: (Math.sin(i * 53.1) * width * 0.5 + width * 0.5),
    cy: (Math.cos(i * 31.7) * height * 0.5 + height * 0.5),
    r: Math.abs(Math.sin(i * 7)) * 1.2 + 0.3,
  }));

  // Per-character rendering with individual transforms for distortion effect
  const chars = label.split('');
  const charWidth = width / (chars.length + 1.5);
  const baseY = height * 0.65;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded-lg border border-zinc-700/60 bg-zinc-900/80 select-none"
      style={{ fontFamily: 'monospace' }}
    >
      <defs>
        <linearGradient id="captchaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a20" />
          <stop offset="100%" stopColor="#111115" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#captchaBg)" rx="8" />

      {/* Noise dots */}
      {noiseDots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill={i % 3 === 0 ? '#ff5c3530' : '#ffffff15'}
        />
      ))}

      {/* Noise lines */}
      {noiseLines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y1}
          x2={l.x2} y2={l.y2}
          stroke={i % 2 === 0 ? '#ff5c3525' : '#ffffff10'}
          strokeWidth={0.6}
        />
      ))}

      {/* Wavy base line */}
      <path
        d={`M 5 ${baseY + 5} Q ${width * 0.3} ${baseY + 10} ${width * 0.5} ${baseY + 6} Q ${width * 0.7} ${baseY + 2} ${width - 5} ${baseY + 7}`}
        fill="none"
        stroke="#ff5c3820"
        strokeWidth="1"
      />

      {/* Main text characters with individual distortion */}
      {chars.map((char, i) => {
        const x = charWidth * (i + 0.8);
        const skewAngle = (Math.sin(i * 2.3 + 1) * 10);
        const yOffset = Math.cos(i * 1.7) * 3;
        const scale = 0.8 + Math.abs(Math.sin(i * 3.1)) * 0.2;
        const color = i % 4 === 0
          ? '#ff5c35'
          : i % 4 === 1
            ? '#f97316'
            : i % 4 === 2
              ? '#fb923c'
              : '#e2e8f0';

        return (
          <text
            key={i}
            x={x}
            y={baseY + yOffset}
            fontSize={18 * scale}
            fontWeight="800"
            fill={color}
            textAnchor="middle"
            transform={`skewX(${skewAngle})`}
            style={{ letterSpacing: '0.02em' }}
          >
            {char}
          </text>
        );
      })}

      {/* Overlay faint distortion chars */}
      {DISTORTION_CHARS.split('').slice(0, 4).map((ch, i) => (
        <text
          key={`noise-${i}`}
          x={15 + i * 50}
          y={10 + (i % 2) * 25}
          fontSize={8}
          fill="#ffffff08"
          fontWeight="400"
        >
          {ch}
        </text>
      ))}
    </svg>
  );
}

const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({ onVerify, resetKey }) => {
  const [challenge, setChallenge] = useState<Challenge>(generateChallenge);
  const [userAnswer, setUserAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setChallenge(generateChallenge());
    setUserAnswer('');
    setStatus('idle');
    onVerify(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onVerify]);

  // Reset when resetKey changes (e.g. mode switch)
  useEffect(() => {
    setChallenge(generateChallenge());
    setUserAnswer('');
    setStatus('idle');
    onVerify(false);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (val: string) => {
    const cleaned = val.replace(/[^0-9-]/g, '');
    setUserAnswer(cleaned);

    if (cleaned === '') {
      setStatus('idle');
      onVerify(false);
      return;
    }

    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed)) {
      if (parsed === challenge.answer) {
        setStatus('correct');
        onVerify(true);
      } else {
        setStatus('wrong');
        onVerify(false);
      }
    }
  };

  const borderColor =
    status === 'correct'
      ? 'border-green-500/50 shadow-green-500/10 shadow-sm'
      : status === 'wrong'
        ? 'border-red-500/40'
        : 'border-zinc-800/80';

  const inputBorder =
    status === 'correct'
      ? 'border-green-500/60 focus:border-green-400 bg-green-500/5'
      : status === 'wrong'
        ? 'border-red-500/60 focus:border-red-400 bg-red-500/5'
        : 'border-zinc-700/80 focus:border-zinc-500 bg-zinc-800/20';

  return (
    <div className={`rounded-xl border bg-zinc-900/40 p-2.5 transition-all duration-300 ${borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-zinc-500" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            Human Verification
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          title="Get a new challenge"
          className="p-1 rounded-md text-zinc-500 hover:text-[#ff5c35] hover:bg-[#ff5c35]/10 transition-all duration-200 group"
        >
          <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300" />
        </button>
      </div>

      {/* Challenge Canvas & Input Row */}
      <div className="flex items-center gap-2">
        <CaptchaCanvas challenge={challenge} />
        
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            placeholder="Answer"
            value={userAnswer}
            onChange={e => handleChange(e.target.value)}
            className={`w-full px-2 py-1.5 rounded-lg border text-white text-xs font-semibold text-center outline-none transition-all duration-200 placeholder:text-zinc-600 ${inputBorder}`}
            maxLength={4}
            autoComplete="off"
            spellCheck={false}
          />
          {status === 'correct' && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-green-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {status === 'wrong' && userAnswer.length > 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-[10px] font-bold">
              ✗
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaptchaWidget;
