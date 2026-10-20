import React, { useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  LineChart as LineChartIcon,
  AlertCircle,
  Table as TableIcon,
  Info,
} from 'lucide-react';
import type {
  BarChartBlock,
  LineChartBlock,
  MultiSeriesChartBlock,
} from '../../../types/blocks';
import { BarChartComponent } from '../charts/BarChartComponent';
import { LineChartComponent } from '../charts/LineChartComponent';
import { MultiSeriesChartComponent } from '../charts/MultiSeriesChartComponent';
import { validatePoints, formatChartValue } from '../charts/chartUtils';

type ChartBlockUnion = BarChartBlock | LineChartBlock | MultiSeriesChartBlock;

interface ChartBlockPreviewProps {
  block: ChartBlockUnion;
}

export const ChartBlockPreview: React.FC<ChartBlockPreviewProps> = ({ block }) => {
  const [showTable, setShowTable] = useState(false);
  const { type, title, description, source_note, data_period, disclaimer, unit, value_format } = block;

  // 1. Validation & Safety Checks
  let validationResult: { isValid: boolean; reason?: string } = { isValid: true };

  if (type === 'chart_bar') {
    validationResult = validatePoints(block.data);
  } else if (type === 'chart_line') {
    validationResult = validatePoints(block.data);
    if (validationResult.isValid && (!Array.isArray(block.data) || block.data.length < 2)) {
      validationResult = { isValid: false, reason: 'Line chart requires at least 2 time-series points.' };
    }
  } else if (type === 'chart_multi_series') {
    const series = block.series;
    if (!Array.isArray(series) || series.length < 2) {
      validationResult = { isValid: false, reason: 'Multi-series chart requires at least 2 series.' };
    } else {
      for (const s of series) {
        const sRes = validatePoints(s.points);
        if (!sRes.isValid) {
          validationResult = { isValid: false, reason: `Series '${s.name}': ${sRes.reason}` };
          break;
        }
      }
    }
  }

  // If payload is malformed or invalid, safely render an honest explanation card without crashing
  if (!validationResult.isValid) {
    return (
      <div className="my-2.5 p-3 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <span>{title} (Chart Unavailable)</span>
        </div>
        <p className="leading-relaxed">
          {validationResult.reason || 'Chart data could not be validated.'} Verified metrics are displayed in textual guidance.
        </p>
      </div>
    );
  }

  // 2. Icon & Type Label
  const getHeaderIcon = () => {
    switch (type) {
      case 'chart_bar':
        return <BarChart2 size={16} className="text-blue-600 shrink-0" />;
      case 'chart_line':
        return <TrendingUp size={16} className="text-indigo-600 shrink-0" />;
      case 'chart_multi_series':
        return <LineChartIcon size={16} className="text-purple-600 shrink-0" />;
    }
  };

  const getTypeBadge = () => {
    switch (type) {
      case 'chart_bar':
        return 'Bar Metric';
      case 'chart_line':
        return 'Time Trend';
      case 'chart_multi_series':
        return block.chart_variant === 'line' ? 'Multi-Line' : 'Grouped Bar';
    }
  };

  // Check if chart has projected points or salary disclaimer
  const hasProjections =
    Boolean(disclaimer) ||
    (type !== 'chart_multi_series' && block.data?.some((d) => d.is_projected));

  return (
    <div className="my-3 p-3.5 sm:p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900">
            {getHeaderIcon()}
            <span>{title}</span>
          </div>
          {description && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {data_period && (
            <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
              {data_period}
            </span>
          )}
          <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
            {getTypeBadge()}
          </span>
        </div>
      </div>

      {/* Projection & Salary Disclaimer (Task 6) */}
      {hasProjections && (
        <div className="my-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-1.5 text-[11px] text-slate-500 leading-normal">
          <Info size={13} className="text-blue-500 shrink-0 mt-0.5" />
          <span>
            {disclaimer ||
              'Data includes sourced estimates and projections. Historical patterns do not guarantee future placement or salary outcomes.'}
          </span>
        </div>
      )}

      {/* Interactive Chart Component */}
      <div className="mt-2">
        {type === 'chart_bar' && (
          <BarChartComponent
            data={block.data}
            unit={unit}
            valueFormat={value_format}
            title={title}
          />
        )}

        {type === 'chart_line' && (
          <LineChartComponent
            data={block.data}
            xLabel={block.x_label}
            yLabel={block.y_label}
            unit={unit}
            valueFormat={value_format}
            title={title}
          />
        )}

        {type === 'chart_multi_series' && (
          <MultiSeriesChartComponent
            series={block.series}
            chartVariant={block.chart_variant}
            unit={unit}
            valueFormat={value_format}
            title={title}
          />
        )}
      </div>

      {/* Footer: Data Table Drawer Toggle & Source Citation */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <div>
          {source_note && (
            <span className="italic">
              Source: <strong className="font-medium text-slate-600">{source_note}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
          aria-expanded={showTable}
        >
          <TableIcon size={12} />
          <span>{showTable ? 'Hide Data Table' : 'View Data Table'}</span>
        </button>
      </div>

      {/* Tabular Data Drawer */}
      {showTable && (
        <div className="mt-2.5 overflow-x-auto rounded border border-slate-200 text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-2.5 py-1.5">Label</th>
                {type === 'chart_multi_series' ? (
                  block.series.map((s, idx) => (
                    <th key={idx} className="px-2.5 py-1.5">{s.name}</th>
                  ))
                ) : (
                  <th className="px-2.5 py-1.5">Value</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] text-slate-600">
              {type !== 'chart_multi_series' ? (
                block.data.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-2.5 py-1.5 font-medium">{d.label}</td>
                    <td className="px-2.5 py-1.5 font-mono">
                      {formatChartValue(d.value, value_format, unit)}
                    </td>
                  </tr>
                ))
              ) : (
                block.series[0].points.map((p, pIdx) => (
                  <tr key={pIdx} className="hover:bg-slate-50">
                    <td className="px-2.5 py-1.5 font-medium">{p.label}</td>
                    {block.series.map((s, sIdx) => (
                      <td key={sIdx} className="px-2.5 py-1.5 font-mono">
                        {formatChartValue(s.points[pIdx]?.value, value_format, unit)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
