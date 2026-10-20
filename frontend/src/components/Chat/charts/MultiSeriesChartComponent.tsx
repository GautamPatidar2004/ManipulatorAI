import React, { useState } from 'react';
import type { ChartSeries } from '../../../types/blocks';
import { formatChartValue, getSeriesColor } from './chartUtils';

interface MultiSeriesChartComponentProps {
  series: ChartSeries[];
  chartVariant?: 'bar' | 'line';
  unit?: string;
  valueFormat?: 'number' | 'currency' | 'percentage';
  title: string;
}

export const MultiSeriesChartComponent: React.FC<MultiSeriesChartComponentProps> = ({
  series,
  chartVariant = 'bar',
  unit,
  valueFormat = 'number',
  title,
}) => {
  const [activeSeriesIdx, setActiveSeriesIdx] = useState<number | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{
    seriesName: string;
    label: string;
    value: number | null;
    isProjected?: boolean;
    x: number;
  } | null>(null);

  if (!series || series.length === 0 || !series[0].points) {
    return null;
  }

  // Categories from the first series
  const categories = series[0].points.map((p) => p.label);
  const catCount = categories.length;

  // Domain max
  const allValues: number[] = [];
  series.forEach((s) => {
    s.points.forEach((p) => {
      if (typeof p.value === 'number' && !isNaN(p.value) && isFinite(p.value)) {
        allValues.push(p.value);
      }
    });
  });
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 100;
  const niceMax = maxVal === 0 ? 10 : Math.ceil(maxVal * 1.15);

  // SVG Geometry
  const width = 560;
  const height = 240;
  const padding = { top: 25, right: 20, bottom: 45, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const ticks = [0, 0.33, 0.66, 1].map((pct) => Math.round(niceMax * pct));

  return (
    <div className="relative w-full overflow-hidden select-none" role="region" aria-label={`Multi-series chart for ${title}`}>
      {/* Interactive Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-2.5 pt-1 text-xs">
        {series.map((s, sIdx) => {
          const color = getSeriesColor(sIdx, s.color);
          const isSelected = activeSeriesIdx === null || activeSeriesIdx === sIdx;

          return (
            <button
              key={sIdx}
              type="button"
              onClick={() =>
                setActiveSeriesIdx(activeSeriesIdx === sIdx ? null : sIdx)
              }
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-50 border-slate-300 font-semibold text-slate-800'
                  : 'bg-white border-transparent text-slate-400 opacity-60'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span>{s.name}</span>
            </button>
          );
        })}
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-72 overflow-visible"
        aria-hidden="true"
      >
        <title>{title}</title>
        <desc>Multi-series comparison chart.</desc>

        {/* Horizontal Gridlines & Y-Axis */}
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

        {/* Content depending on chartVariant */}
        {chartVariant === 'bar' ? (
          // Grouped Bars Mode
          <g>
            {categories.map((catLabel, catIdx) => {
              const groupSlotWidth = chartWidth / catCount;
              const groupStartX = padding.left + catIdx * groupSlotWidth;
              const activeCount = series.length;
              const innerBarWidth = Math.min(
                18,
                Math.max(6, (groupSlotWidth * 0.75) / activeCount)
              );
              const groupContentWidth = innerBarWidth * activeCount;
              const offsetStart = groupStartX + (groupSlotWidth - groupContentWidth) / 2;

              return (
                <g key={catIdx}>
                  {series.map((s, sIdx) => {
                    const pt = s.points[catIdx];
                    if (!pt) return null;

                    const isDimmed = activeSeriesIdx !== null && activeSeriesIdx !== sIdx;
                    const barColor = getSeriesColor(sIdx, s.color);
                    const x = offsetStart + sIdx * innerBarWidth;
                    const isMissing = pt.value === null || pt.value === undefined;
                    const barHeight = isMissing
                      ? 0
                      : (pt.value! / niceMax) * chartHeight;
                    const y = padding.top + chartHeight - barHeight;

                    return (
                      <g
                        key={sIdx}
                        className="cursor-pointer"
                        opacity={isDimmed ? 0.25 : 1}
                        onMouseEnter={() =>
                          setHoveredInfo({
                            seriesName: s.name,
                            label: catLabel,
                            value: pt.value,
                            isProjected: pt.is_projected,
                            x,
                          })
                        }
                        onMouseLeave={() => setHoveredInfo(null)}
                      >
                        {isMissing ? (
                          <rect
                            x={x}
                            y={padding.top + 20}
                            width={innerBarWidth - 2}
                            height={chartHeight - 20}
                            fill="#f8fafc"
                            stroke="#cbd5e1"
                            strokeDasharray="2 2"
                            rx={2}
                          />
                        ) : (
                          <rect
                            x={x}
                            y={y}
                            width={innerBarWidth - 2}
                            height={Math.max(2, barHeight)}
                            fill={barColor}
                            rx={2}
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* X-Axis Category Label */}
                  <text
                    x={groupStartX + groupSlotWidth / 2}
                    y={padding.top + chartHeight + 16}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px] font-medium"
                  >
                    {catLabel.length > 9 ? `${catLabel.slice(0, 8)}…` : catLabel}
                  </text>
                </g>
              );
            })}
          </g>
        ) : (
          // Multi-Line Mode
          <g>
            {series.map((s, sIdx) => {
              const isDimmed = activeSeriesIdx !== null && activeSeriesIdx !== sIdx;
              const color = getSeriesColor(sIdx, s.color);
              const stepX = catCount > 1 ? chartWidth / (catCount - 1) : chartWidth / 2;

              // Compute segmented line paths with gaps for missing points
              const pathSegments: string[] = [];
              let curSegment = '';

              s.points.forEach((pt, i) => {
                const x = padding.left + i * stepX;
                if (pt.value === null || pt.value === undefined) {
                  if (curSegment) {
                    pathSegments.push(curSegment);
                    curSegment = '';
                  }
                } else {
                  const y = padding.top + chartHeight - (pt.value / niceMax) * chartHeight;
                  if (!curSegment) {
                    curSegment = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                  } else {
                    curSegment += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                  }
                }
              });
              if (curSegment) pathSegments.push(curSegment);

              return (
                <g key={sIdx} opacity={isDimmed ? 0.2 : 1}>
                  {pathSegments.map((dPath, pIdx) => (
                    <path
                      key={pIdx}
                      d={dPath}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  ))}

                  {/* Points */}
                  {s.points.map((pt, i) => {
                    const x = padding.left + i * stepX;
                    if (pt.value === null || pt.value === undefined) return null;
                    const y = padding.top + chartHeight - (pt.value / niceMax) * chartHeight;

                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={3}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={1}
                        className="cursor-pointer"
                        onMouseEnter={() =>
                          setHoveredInfo({
                            seriesName: s.name,
                            label: pt.label,
                            value: pt.value,
                            isProjected: pt.is_projected,
                            x,
                          })
                        }
                        onMouseLeave={() => setHoveredInfo(null)}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* X-Axis Category Labels */}
            {categories.map((catLabel, i) => {
              const stepX = catCount > 1 ? chartWidth / (catCount - 1) : chartWidth / 2;
              const x = padding.left + i * stepX;
              return (
                <text
                  key={i}
                  x={x}
                  y={padding.top + chartHeight + 16}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-medium"
                >
                  {catLabel}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {/* Floating Tooltip */}
      {hoveredInfo && (
        <div
          className="absolute pointer-events-none z-10 p-2 bg-slate-900/95 text-white rounded-md shadow-lg text-xs backdrop-blur-xs transition-all"
          style={{
            left: `${Math.min(85, Math.max(15, (hoveredInfo.x / width) * 100))}%`,
            top: '32px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold text-slate-100">{hoveredInfo.seriesName}</div>
          <div className="text-[11px] text-slate-300">{hoveredInfo.label}</div>
          <div className="text-blue-300 font-mono mt-0.5">
            {formatChartValue(hoveredInfo.value, valueFormat, unit)}
            {hoveredInfo.isProjected && ' (Projected)'}
          </div>
        </div>
      )}
    </div>
  );
};
