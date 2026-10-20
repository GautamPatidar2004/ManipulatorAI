import React from 'react';
import { Layers, CheckCircle2 } from 'lucide-react';
import type { AnyStructuredBlock, SupportedBlockType } from '../../types/blocks';
import type { StructuredBlock } from '../../types/chat';
import { BlockErrorBoundary } from './blocks/BlockErrorBoundary';
import { TextBlockView } from './blocks/TextBlockView';
import { HeadingBlockView } from './blocks/HeadingBlockView';
import { BulletListBlockView } from './blocks/BulletListBlockView';
import { KeyTakeawaysBlockView } from './blocks/KeyTakeawaysBlockView';
import { InfoCardBlockView } from './blocks/InfoCardBlockView';
import { RecommendationCardBlockView } from './blocks/RecommendationCardBlockView';
import { ComparisonTableBlockView } from './blocks/ComparisonTableBlockView';
import { RoadmapTimelineBlockView } from './blocks/RoadmapTimelineBlockView';
import { SkillGapBlockView } from './blocks/SkillGapBlockView';
import { LearningPlanBlockView } from './blocks/LearningPlanBlockView';
import { EvidenceReferenceBlockView } from './blocks/EvidenceReferenceBlockView';
import { LimitationNoticeBlockView } from './blocks/LimitationNoticeBlockView';
import { FollowUpQuestionsBlockView } from './blocks/FollowUpQuestionsBlockView';
import { QuickRepliesBlockView } from './blocks/QuickRepliesBlockView';
import { ChartBlockPreview } from './blocks/ChartBlockPreview';

const ALLOWLISTED_BLOCK_TYPES: Set<SupportedBlockType> = new Set([
  'text',
  'heading',
  'bullet_list',
  'key_takeaways',
  'info_card',
  'recommendation_card',
  'comparison_table',
  'roadmap_timeline',
  'chart_bar',
  'chart_line',
  'chart_multi_series',
  'skill_gap_analysis',
  'learning_plan',
  'evidence_reference',
  'limitation_notice',
  'follow_up_questions',
  'quick_replies',
]);

interface StructuredBlockRendererProps {
  block: StructuredBlock;
  mainContent?: string;
  onActionClick?: (payload: string) => void;
}

export const StructuredBlockRenderer: React.FC<StructuredBlockRendererProps> = ({
  block,
  mainContent,
  onActionClick,
}) => {
  if (!block || typeof block !== 'object') {
    return null;
  }

  // 1. Resolve list of blocks from versioned payload or direct block
  let resolvedBlocks: AnyStructuredBlock[] = [];

  if (Array.isArray(block.blocks) && block.blocks.length > 0) {
    resolvedBlocks = block.blocks;
  } else if (
    block.data &&
    typeof block.data === 'object' &&
    Array.isArray(block.data.blocks) &&
    block.data.blocks.length > 0
  ) {
    resolvedBlocks = block.data.blocks as AnyStructuredBlock[];
  } else if (ALLOWLISTED_BLOCK_TYPES.has(block.type as SupportedBlockType)) {
    // Top-level block is directly a structured block
    resolvedBlocks = [block as unknown as AnyStructuredBlock];
  }

  // 2. Filter out text blocks that duplicate main message content or conversational text
  const cleanBlocks = resolvedBlocks.filter((b) => {
    if (!b || typeof b !== 'object') return false;
    if (b.type === 'text') {
      const bText = (b.text || '').trim();
      const mText = (mainContent || '').trim();
      if (!bText) return false;
      // If block text repeats message text, omit it
      if (mText && (mText === bText || mText.includes(bText) || bText.includes(mText))) {
        return false;
      }
    }
    return true;
  });

  // 3. Render Rich Versioned Blocks
  if (cleanBlocks.length > 0) {
    return (
      <div className="mt-3 space-y-2.5 w-full">
        {cleanBlocks.map((b, idx) => (
          <BlockErrorBoundary key={idx}>
            {renderBlock(b, idx, onActionClick)}
          </BlockErrorBoundary>
        ))}
      </div>
    );
  }

  // 4. Backward Compatibility Fallback for Early Prototype Structured Messages
  const data = block.data;
  if (data && typeof data === 'object') {
    return (
      <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <Layers size={14} className="text-blue-600" />
            <span>Structured Guidance</span>
          </div>
        </div>

        {block.title && (
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-2">{block.title}</h4>
        )}

        {Array.isArray(data.items) && data.items.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {data.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-600">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <span>{String(item)}</span>
              </li>
            ))}
          </ul>
        )}

        {typeof data.summary === 'string' && data.summary && (
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{data.summary}</p>
        )}
      </div>
    );
  }

  // 5. Clean exit when no rich visual blocks are needed (e.g. simple conversational replies)
  return null;
};

function renderBlock(
  block: AnyStructuredBlock,
  idx: number,
  onActionClick?: (payload: string) => void
): React.ReactNode {
  if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
    return null;
  }

  switch (block.type) {
    case 'text':
      return <TextBlockView key={`text-${idx}`} block={block} />;
    case 'heading':
      return <HeadingBlockView key={`heading-${idx}`} block={block} />;
    case 'bullet_list':
      return <BulletListBlockView key={`bullet-${idx}`} block={block} />;
    case 'key_takeaways':
      return <KeyTakeawaysBlockView key={`takeaways-${idx}`} block={block} />;
    case 'info_card':
      return <InfoCardBlockView key={`info-${idx}`} block={block} />;
    case 'recommendation_card':
      return (
        <RecommendationCardBlockView
          key={`rec-${idx}`}
          block={block}
          onActionClick={onActionClick}
        />
      );
    case 'comparison_table':
      return <ComparisonTableBlockView key={`table-${idx}`} block={block} />;
    case 'roadmap_timeline':
      return <RoadmapTimelineBlockView key={`timeline-${idx}`} block={block} />;
    case 'skill_gap_analysis':
      return <SkillGapBlockView key={`skillgap-${idx}`} block={block} />;
    case 'learning_plan':
      return <LearningPlanBlockView key={`plan-${idx}`} block={block} />;
    case 'evidence_reference':
      return <EvidenceReferenceBlockView key={`evidence-${idx}`} block={block} />;
    case 'limitation_notice':
      return <LimitationNoticeBlockView key={`limitation-${idx}`} block={block} />;
    case 'follow_up_questions':
      return (
        <FollowUpQuestionsBlockView
          key={`followup-${idx}`}
          block={block}
          onActionClick={onActionClick}
        />
      );
    case 'quick_replies':
      return (
        <QuickRepliesBlockView
          key={`quickreply-${idx}`}
          block={block}
          onActionClick={onActionClick}
        />
      );
    case 'chart_bar':
    case 'chart_line':
    case 'chart_multi_series':
      return <ChartBlockPreview key={`chart-${idx}`} block={block} />;
    default:
      // Unknown / model-invented component: ignore without crashing
      return null;
  }
}
