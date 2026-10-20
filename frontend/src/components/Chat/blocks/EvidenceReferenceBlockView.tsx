import React from 'react';
import { FileCheck, ExternalLink } from 'lucide-react';
import type { EvidenceReferenceBlock } from '../../../types/blocks';
import { isSafeHttpUrl } from './urlUtils';

interface EvidenceReferenceBlockViewProps {
  block: EvidenceReferenceBlock;
}

export const EvidenceReferenceBlockView: React.FC<EvidenceReferenceBlockViewProps> = ({ block }) => {
  const { title = 'Verified Reference Citations', summary, sources = [] } = block;
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return (
    <div className="my-2.5 p-3 sm:p-3.5 bg-blue-50/50 border border-blue-200/70 rounded-xl">
      {/* Title */}
      <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-blue-950 mb-1.5">
        <FileCheck size={15} className="text-blue-600 shrink-0" />
        <span>{title}</span>
      </div>

      {summary && (
        <p className="text-xs text-slate-600 mb-2 leading-relaxed">{summary}</p>
      )}

      {/* Verified Sources List */}
      <div className="space-y-1.5">
        {sources.map((src, idx) => {
          const hasSafeLink = isSafeHttpUrl(src.url);

          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-blue-100/80 text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                {hasSafeLink ? (
                  <a
                    href={src.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline truncate inline-flex items-center gap-1"
                  >
                    <span>{src.title}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                ) : (
                  <span className="font-medium text-slate-700 truncate">
                    {src.title}
                  </span>
                )}
              </div>

              {typeof src.similarity_score === 'number' && (
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                  {Math.round(src.similarity_score * 100)}% Match
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
