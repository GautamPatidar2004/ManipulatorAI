import React, { useState } from 'react';
import type { ChartDataPoint } from '../../../types/blocks';
import { formatChartValue } from './chartUtils';

interface LineChartComponentProps {
  data: ChartDataPoint[];
  xLabel?: string;
  yLabel?: string;
  unit?: string;
  valueFormat?: 'number' | 'currency' | 'percentage';
  title: string;
}

export const LineChartComponent: React.FC<LineChartComponentProps> = ({
  data,
  xLabel,
  yLabel,
  unit,
  valueFormat = 'number',
  title,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter valid numbers for domain calculation
  const validValues = data
    .map((d) => d.value)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v) && isFinite(v));

  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 100;

  // Domain padding
  const niceMin = Math.max(0, Math.floor(minVal * 0.85));
  const niceMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.15);
  const domainRange = niceMax - niceMin || 1;

  // SVG Geometry
  const width = 560;
  const height = 240;
  const padding = { top: 25, right: 25, bottom: 45, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const count = data.length;
  const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth / 2;

  // Compute coordinate points (x, y, isMissing)
  const coords = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const isMissing = d.value === null || d.value === undefined;
    const y = isMissing
      ? null
      : padding.top + chartHeight - ((d.value! - niceMin) / domainRange) * chartHeight;
    return { x, y, isMissing, data: d, index: i };
  });

  // Build segmented SVG paths with real gaps across missing points
  const pathSegments: string[] = [];
  let currentSegment = '';

  coords.forEach((pt) => {
    if (pt.isMissing || pt.y === null) {
      if (currentSegment) {
        pathSegments.push(currentSegment);
        currentSegment = '';
      }
    } else {
      if (!currentSegment) {
        currentSegment = `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      } else {
        currentSegment += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      }
    }
  });
  if (currentSegment) {
    pathSegments.push(currentSegment);
  }

  // Ticks
  const ticks = [0, 0.33, 0.66, 1].map((pct) => Math.round(niceMin + domainRange * pct));

  return (
    <div className="relative w-full overflow-hidden select-none" role="region" aria-label={`Line chart for ${title}`}>
      {/* Accessible Table */}
      <table className="sr-only">
        <caption>{title} - Data Trend</caption>
        <thead>
          <tr>
            <th scope="col">Time / Label</th>
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
        <desc>Time-series trend line chart across labeled periods.</desc>

        {/* Horizontal Gridlines & Y-Axis */}
        {ticks.map((t, idx) => {
          const y = padding.top + chartHeight - ((t - niceMin) / domainRange) * chartHeight;
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={idx === 0 ? undefined : '3 3'}
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

        {/* Y-Axis Label */}
        {yLabel && (
          <text
            x={padding.left - 36}
            y={padding.top + chartHeight / 2}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-medium"
            transform={`rotate(-90, ${padding.left - 36}, ${padding.top + chartHeight / 2})`}
          >
            {yLabel}
          </text>
        )}

        {/* Render Segmented Paths (with real gaps for missing points) */}
        {pathSegments.map((dPath, pIdx) => (
          <path
            key={pIdx}
            d={dPath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Data Points and Interactivity */}
        {coords.map((pt, idx) => {
          const isHovered = hoveredIdx === idx;
          const isProjected = pt.data.is_projected;

          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${pt.data.label}: ${formatChartValue(pt.data.value, valueFormat, unit)}`}
            >
              {pt.isMissing ? (
                // Hollow grey dot for missing points
                <circle
                  cx={pt.x}
                  cy={padding.top + chartHeight}
                  r={3.5}
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              ) : (
                <g>
                  {/* Outer halo on hover */}
                  {isHovered && (
                    <circle cx={pt.x} cy={pt.y!} r={7} fill="#bfdbfe" opacity={0.6} />
                  )}
                  {/* Point Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y!}
                    r={isHovered ? 4.5 : 3.5}
                    fill={isProjected ? '#ffffff' : '#2563eb'}
                    stroke="#2563eb"
                    strokeWidth={isProjected ? 2 : 1.5}
                    className="transition-transform duration-150"
                  />
                </g>
              )}

              {/* X-Axis Period Label */}
              <text
                x={pt.x}
                y={padding.top + chartHeight + 16}
                textAnchor="middle"
                className={`text-[10px] transition-colors ${
                  isHovered ? 'fill-blue-700 font-bold' : 'fill-slate-500 font-medium'
                }`}
              >
                {pt.data.label}
              </text>
            </g>
          );
        })}

        {/* X-Axis Label */}
        {xLabel && (
          <text
            x={padding.left + chartWidth / 2}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-medium"
          >
            {xLabel}
          </text>
        )}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && (
        <div
          className="absolute pointer-events-none z-10 p-2 bg-slate-900/95 text-white rounded-md shadow-lg text-xs backdrop-blur-xs transition-all"
          style={{
            left: `${Math.min(
              85,
              Math.max(15, (coords[hoveredIdx].x / width) * 100)
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
