/**
 * Dynamic Structured Response Contract - Version 1.0
 * Shared type definitions mirroring the FastAPI backend schema.
 * Defines allowlisted response blocks without arbitrary executable code.
 */

export type SupportedBlockType =
  | 'text'
  | 'heading'
  | 'bullet_list'
  | 'key_takeaways'
  | 'info_card'
  | 'recommendation_card'
  | 'comparison_table'
  | 'roadmap_timeline'
  | 'chart_bar'
  | 'chart_line'
  | 'chart_multi_series'
  | 'skill_gap_analysis'
  | 'learning_plan'
  | 'evidence_reference'
  | 'limitation_notice'
  | 'follow_up_questions'
  | 'quick_replies';

// ---------------------------------------------------------------------------
// Supporting Sub-Models
// ---------------------------------------------------------------------------

export interface ChartDataPoint {
  label: string;
  value: number | null;
  category?: string;
  is_projected?: boolean;
  status?: 'available' | 'unavailable' | 'estimated' | 'projected';
}

export interface ChartSeries {
  name: string;
  points: ChartDataPoint[];
  series_type?: 'bar' | 'line';
  color?: string;
}

export interface RoadmapStep {
  step_number: number;
  title: string;
  description: string;
  duration?: string;
  milestones: string[];
}

export interface LearningModule {
  module_index: number;
  title: string;
  topics: string[];
  duration?: string;
  recommended_resources: string[];
}

export interface EvidenceSource {
  source_id: string;
  title: string;
  url?: string;
  similarity_score?: number;
}

export interface QuickReplyOption {
  label: string;
  payload: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// Individual Block Schemas
// ---------------------------------------------------------------------------

export interface TextBlock {
  type: 'text';
  text: string;
  variant?: 'body' | 'callout' | 'quote';
}

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  text: string;
}

export interface BulletListBlock {
  type: 'bullet_list';
  title?: string;
  items: string[];
}

export interface KeyTakeawaysBlock {
  type: 'key_takeaways';
  title: string;
  points: string[];
}

export interface InfoCardBlock {
  type: 'info_card';
  title: string;
  description: string;
  badge?: string;
  icon?: string;
}

export interface RecommendationCardBlock {
  type: 'recommendation_card';
  title: string;
  description: string;
  reasoning: string;
  risks_and_limitations: string;
  priority: 'high' | 'medium' | 'low';
  action_label?: string;
}

export interface ComparisonTableBlock {
  type: 'comparison_table';
  title: string;
  headers: string[];
  rows: string[][];
  summary_verdict?: string;
}

export interface RoadmapTimelineBlock {
  type: 'roadmap_timeline';
  title: string;
  steps: RoadmapStep[];
  estimated_duration?: string;
}

export interface BarChartBlock {
  type: 'chart_bar';
  title: string;
  description?: string;
  data: ChartDataPoint[];
  unit?: string;
  value_format?: 'number' | 'currency' | 'percentage';
  source_note?: string;
  data_period?: string;
  disclaimer?: string;
}

export interface LineChartBlock {
  type: 'chart_line';
  title: string;
  description?: string;
  data: ChartDataPoint[];
  x_label?: string;
  y_label?: string;
  unit?: string;
  value_format?: 'number' | 'currency' | 'percentage';
  source_note?: string;
  data_period?: string;
  disclaimer?: string;
}

export interface MultiSeriesChartBlock {
  type: 'chart_multi_series';
  title: string;
  description?: string;
  chart_variant?: 'bar' | 'line';
  series: ChartSeries[];
  unit?: string;
  value_format?: 'number' | 'currency' | 'percentage';
  x_label?: string;
  y_label?: string;
  source_note?: string;
  data_period?: string;
  disclaimer?: string;
}

export interface SkillGapBlock {
  type: 'skill_gap_analysis';
  target_role: string;
  prerequisites: string[];
  existing_skills: string[];
  missing_skills: string[];
  recommended_actions: string[];
}

export interface LearningPlanBlock {
  type: 'learning_plan';
  title: string;
  modules: LearningModule[];
  prerequisites: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface EvidenceReferenceBlock {
  type: 'evidence_reference';
  title: string;
  summary?: string;
  sources: EvidenceSource[];
}

export interface LimitationNoticeBlock {
  type: 'limitation_notice';
  title: string;
  message: string;
  missing_fields?: string[];
}

export interface FollowUpQuestionsBlock {
  type: 'follow_up_questions';
  questions: string[];
}

export interface QuickRepliesBlock {
  type: 'quick_replies';
  options: QuickReplyOption[];
}

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

export type AnyStructuredBlock =
  | TextBlock
  | HeadingBlock
  | BulletListBlock
  | KeyTakeawaysBlock
  | InfoCardBlock
  | RecommendationCardBlock
  | ComparisonTableBlock
  | RoadmapTimelineBlock
  | BarChartBlock
  | LineChartBlock
  | MultiSeriesChartBlock
  | SkillGapBlock
  | LearningPlanBlock
  | EvidenceReferenceBlock
  | LimitationNoticeBlock
  | FollowUpQuestionsBlock
  | QuickRepliesBlock;

// ---------------------------------------------------------------------------
// Top-Level Container
// ---------------------------------------------------------------------------

export interface VersionedStructuredResponse {
  version: string;
  intent: string;
  narrative_summary?: string;
  blocks: AnyStructuredBlock[];
  sources: EvidenceSource[];
  metadata?: Record<string, unknown>;
}
