import React, { useState } from 'react';
import type { ChartDataPoint } from '../../../types/blocks';
import { formatChartValue, getSeriesColor } from './chartUtils';

interface BarChartComponentProps {
  data: ChartDataPoint[];
  unit?: string;
  valueFormat?: 'number' | 'currency' | 'percentage';
  title: string;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  data,
  unit,
  valueFormat = 'number',
  title,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter available numeric values to determine max bound
  const validValues = data
    .map((d) => d.value)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v) && isFinite(v));

  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 100;
  const niceMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.15);

  // SVG Geometry
  const width = 560;
  const height = 240;
  const padding = { top: 25, right: 20, bottom: 40, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barCount = data.length;
  const slotWidth = chartWidth / barCount;
  const barWidth = Math.min(42, Math.max(14, slotWidth * 0.65));

  // Y-axis grid ticks (4 ticks)
  const ticks = [0, 0.33, 0.66, 1].map((pct) => Math.round(niceMax * pct));

  return (
    <div className="relative w-full overflow-hidden select-none" role="region" aria-label={`Bar chart for ${title}`}>
      {/* Accessible table summary for screen readers */}
      <table className="sr-only">
        <caption>{title} - Data Summary</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{d.label}</td>
              <td>{formatChartValue(d.value, valueFormat, unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-72 overflow-visible"
        aria-hidden="true"
      >
        <title>{title}</title>
        <desc>Dynamic bar chart showing values across categories.</desc>

        {/* Horizontal Gridlines & Y-Axis Labels */}
        {ticks.map((t, idx) => {
          const y = padding.top + chartHeight - (t / niceMax) * chartHeight;
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={t === 0 ? undefined : '3 3'}
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, idx) => {
          const x = padding.left + idx * slotWidth + (slotWidth - barWidth) / 2;
          const isMissing = d.value === null || d.value === undefined;
          const barHeight = isMissing ? 0 : (d.value! / niceMax) * chartHeight;
          const y = padding.top + chartHeight - barHeight;
          const barColor = getSeriesColor(idx);
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${d.label}: ${formatChartValue(d.value, valueFormat, unit)}`}
            >
              {isMissing ? (
                // Transparent, honest representation for unavailable values
                <g>
                  <rect
                    x={x}
                    y={padding.top + 10}
                    width={barWidth}
                    height={chartHeight - 10}
                    fill="#f8fafc"
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                    rx={3}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={padding.top + chartHeight / 2}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px] font-medium"
                    transform={`rotate(-90, ${x + barWidth / 2}, ${padding.top + chartHeight / 2})`}
                  >
                    No Data
                  </text>
                </g>
              ) : (
                // Rendered Data Bar
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    fill={d.is_projected ? '#93c5fd' : barColor}
                    stroke={d.is_projected ? '#3b82f6' : undefined}
                    strokeDasharray={d.is_projected ? '2 2' : undefined}
                    rx={3}
                    className={`transition-all duration-200 ${
                      isHovered ? 'filter drop-shadow-sm brightness-110' : ''
                    }`}
                  />
                  {/* Top value badge if space permits and bar count is low */}
                  {barCount <= 7 && !isMissing && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      className="fill-slate-600 text-[10px] font-semibold font-mono"
                    >
                      {d.value}
                    </text>
                  )}
                </g>
              )}

              {/* X-Axis Category Label */}
              <text
                x={x + barWidth / 2}
                y={padding.top + chartHeight + 16}
                textAnchor="middle"
                className={`text-[10px] transition-colors ${
                  isHovered ? 'fill-blue-700 font-bold' : 'fill-slate-500 font-medium'
                }`}
              >
                {d.label.length > 10 && barCount > 5 ? `${d.label.slice(0, 8)}…` : d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && (
        <div
          className="absolute pointer-events-none z-10 p-2 bg-slate-900/95 text-white rounded-md shadow-lg text-xs backdrop-blur-xs transition-all"
          style={{
            left: `${Math.min(
              85,
              Math.max(
                15,
                ((padding.left + hoveredIdx * slotWidth + slotWidth / 2) / width) * 100
              )
            )}%`,
            top: '8px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-slate-100">{data[hoveredIdx].label}</div>
          <div className="text-blue-300 font-mono mt-0.5">
            {formatChartValue(data[hoveredIdx].value, valueFormat, unit)}
            {data[hoveredIdx].is_projected && ' (Projected)'}
          </div>
          {data[hoveredIdx].category && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              Category: {data[hoveredIdx].category}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
