import React from 'react';
import { Columns3, CheckCircle2 } from 'lucide-react';
import type { ComparisonTableBlock } from '../../../types/blocks';

interface ComparisonTableBlockViewProps {
  block: ComparisonTableBlock;
}

export const ComparisonTableBlockView: React.FC<ComparisonTableBlockViewProps> = ({ block }) => {
  const { title, headers, rows, summary_verdict } = block;
  if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className="my-3 p-3 sm:p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
      {/* Title */}
      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-900 mb-2.5">
        <Columns3 size={15} className="text-blue-600 shrink-0" />
        <span>{title}</span>
      </div>

      {/* Table with responsive horizontal scroll */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 -mx-1 sm:mx-0">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap first:pl-3 last:pr-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50 hover:bg-slate-50'}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-3 py-2 text-slate-600 leading-normal align-top first:font-medium first:text-slate-800"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Verdict */}
      {summary_verdict && (
        <div className="mt-2.5 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-2 text-xs text-slate-700">
          <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-blue-900">Verdict: </span>
            <span>{summary_verdict}</span>
          </div>
        </div>
      )}
    </div>
  );
};
