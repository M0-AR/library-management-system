"use client";

import { useMemo } from "react";

export interface SeriesPoint {
  label: string;
  values: number[];
}

export function AreaChart({
  points,
  series,
  height = 220,
  yTicks = 4,
}: {
  points: { label: string }[];
  series: { name: string; color: string; values: number[] }[];
  height?: number;
  yTicks?: number;
}) {
  const width = 640;
  const padding = { top: 14, right: 8, bottom: 26, left: 34 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = useMemo(() => {
    const all = series.flatMap((item) => item.values);
    return Math.max(1, ...all);
  }, [series]);

  const xFor = (index: number) =>
    padding.left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yFor = (value: number) => padding.top + innerH - (value / max) * innerH;

  const gridLines = Array.from({ length: yTicks + 1 }, (_, index) => {
    const value = Math.round((max / yTicks) * index);
    return { value, y: yFor(value) };
  });

  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {gridLines.map((line) => (
          <g key={line.value}>
            <line x1={padding.left} x2={width - padding.right} y1={line.y} y2={line.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padding.left - 8} y={line.y + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
              {line.value}
            </text>
          </g>
        ))}
        {series.map((item, seriesIndex) => {
          const line = item.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
          const area = `${padding.left},${padding.top + innerH} ${line} ${xFor(item.values.length - 1)},${padding.top + innerH}`;
          return (
            <g key={item.name}>
              <defs>
                <linearGradient id={`grad-${seriesIndex}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={item.color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={area} fill={`url(#grad-${seriesIndex})`} />
              <polyline points={line} fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {item.values.map((value, index) => (
                <circle key={index} cx={xFor(index)} cy={yFor(value)} r="2.4" fill="white" stroke={item.color} strokeWidth="1.6">
                  <title>{`${item.name} · ${points[index]?.label}: ${value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text key={index} x={xFor(index)} y={height - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex items-center gap-4 px-1">
        {series.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MiniBars({
  values,
  color = "var(--brand)",
  height = 34,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((value, index) => (
        <span
          key={index}
          className="w-1.5 rounded-full transition-all"
          style={{ height: `${Math.max(8, (value / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * (value / max) }}
          title={String(value)}
        />
      ))}
    </div>
  );
}

export function ProgressRing({
  value,
  max,
  size = 84,
  stroke = 8,
  color = "var(--brand)",
  label,
  sublabel,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max <= 0 ? 0 : Math.min(1, value / max);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-sm font-bold text-ink-800">{label}</p>
        {sublabel ? <p className="text-[10px] text-ink-400">{sublabel}</p> : null}
      </div>
    </div>
  );
}

export function BarList({
  items,
  color = "var(--brand)",
}: {
  items: { label: string; value: number; hint?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="group">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="truncate text-[13px] font-medium text-ink-700">{item.label}</p>
            <p className="shrink-0 text-[13px] font-semibold text-ink-800">{item.hint ?? item.value}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
