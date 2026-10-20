import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StructuredBlockRenderer } from '../components/Chat/StructuredBlockRenderer';
import type { StructuredBlock } from '../types/chat';

describe('StructuredBlockRenderer', () => {
  it('renders TextBlock variants and HeadingBlock correctly', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        { type: 'heading', level: 2, text: 'Degree Exploration' },
        { type: 'text', text: 'Callout note on requirements.', variant: 'callout' },
        { type: 'text', text: 'Standard narrative explanation.', variant: 'body' },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Degree Exploration')).toBeDefined();
    expect(screen.getByText('Callout note on requirements.')).toBeDefined();
    expect(screen.getByText('Standard narrative explanation.')).toBeDefined();
  });

  it('renders BulletListBlock and KeyTakeawaysBlock', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'bullet_list',
          title: 'Core Prerequisites',
          items: ['Data Structures', 'Algorithms', 'Computer Networks'],
        },
        {
          type: 'key_takeaways',
          title: 'Key Guidance Takeaways',
          points: ['Focus on foundations first.', 'Maintain strong academic standing.'],
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Core Prerequisites')).toBeDefined();
    expect(screen.getByText('Data Structures')).toBeDefined();
    expect(screen.getByText('Key Guidance Takeaways')).toBeDefined();
    expect(screen.getByText('Focus on foundations first.')).toBeDefined();
  });

  it('renders InfoCardBlock and RecommendationCardBlock with priority badges and interactive action', () => {
    const onAction = vi.fn();
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'info_card',
          title: 'Parent Discussion Insight',
          description: 'Parents value campus stability and ROI.',
          badge: 'Strategy',
          icon: 'shield-check',
        },
        {
          type: 'recommendation_card',
          title: 'B.Tech in Artificial Intelligence',
          description: 'Four-year program focusing on ML algorithms.',
          reasoning: 'Matches stated interest in mathematical modeling.',
          risks_and_limitations: 'High cutoff rank required for top tier institutes.',
          priority: 'high',
          action_label: 'Explore Entrance Syllabus',
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} onActionClick={onAction} />);

    expect(screen.getByText('Parent Discussion Insight')).toBeDefined();
    expect(screen.getByText('B.Tech in Artificial Intelligence')).toBeDefined();
    expect(screen.getByText('HIGH Priority')).toBeDefined();
    expect(screen.getByText('Why Recommended')).toBeDefined();
    expect(screen.getByText('Risks & Considerations')).toBeDefined();

    const actionBtn = screen.getByText('Explore Entrance Syllabus');
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledWith('Explore Entrance Syllabus');
  });

  it('renders ComparisonTableBlock with responsive table and verdict', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'comparison_table',
          title: 'BTech vs BCA Matrix',
          headers: ['Criteria', 'BTech CSE', 'BCA'],
          rows: [
            ['Duration', '4 Years', '3 Years'],
            ['Eligibility', 'Physics, Chem, Math', 'Any 10+2 Stream'],
          ],
          summary_verdict: 'Choose BTech for core engineering campus drives.',
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('BTech vs BCA Matrix')).toBeDefined();
    expect(screen.getByText('Criteria')).toBeDefined();
    expect(screen.getByText('BTech CSE')).toBeDefined();
    expect(screen.getByText('Duration')).toBeDefined();
    expect(screen.getByText('Choose BTech for core engineering campus drives.')).toBeDefined();
  });

  it('renders RoadmapTimelineBlock with step numbers, duration, and milestones', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'roadmap_timeline',
          title: 'Full Stack Career Roadmap',
          estimated_duration: '9 Months',
          steps: [
            {
              step_number: 1,
              title: 'Frontend Fundamentals',
              description: 'HTML5, CSS3, modern TypeScript, and React.',
              duration: 'Months 1-3',
              milestones: ['Build responsive portfolio', 'Deploy on Vercel'],
            },
          ],
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Full Stack Career Roadmap')).toBeDefined();
    expect(screen.getByText('9 Months')).toBeDefined();
    expect(screen.getByText('Frontend Fundamentals')).toBeDefined();
    expect(screen.getByText('Months 1-3')).toBeDefined();
    expect(screen.getByText('Build responsive portfolio')).toBeDefined();
  });

  it('renders SkillGapBlock and LearningPlanBlock cleanly', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'skill_gap_analysis',
          target_role: 'Cloud Architect',
          prerequisites: ['Networking', 'Linux'],
          existing_skills: ['Linux', 'Docker'],
          missing_skills: ['Kubernetes', 'Terraform'],
          recommended_actions: ['Complete CKA certification', 'Build multi-cloud IaC repo'],
        },
        {
          type: 'learning_plan',
          title: 'Terraform Masterclass',
          level: 'intermediate',
          prerequisites: ['AWS Console'],
          modules: [
            {
              module_index: 1,
              title: 'HCL Syntax & Providers',
              topics: ['State Files', 'Variables'],
              duration: '1 Week',
              recommended_resources: ['HashiCorp Learn'],
            },
          ],
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Skill-Gap Analysis: Cloud Architect')).toBeDefined();
    expect(screen.getByText('Docker')).toBeDefined();
    expect(screen.getByText('Kubernetes')).toBeDefined();
    expect(screen.getByText('Terraform Masterclass')).toBeDefined();
    expect(screen.getByText('Module 1: HCL Syntax & Providers')).toBeDefined();
  });

  it('renders EvidenceReferenceBlock and verifies safe link protocol validation', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'evidence_reference',
          title: 'Verified Curriculum Standards',
          summary: 'Validated against national higher education norms.',
          sources: [
            {
              source_id: 'src_1',
              title: 'AICTE Handbook 2024',
              url: 'https://aicte-india.org/handbook',
              similarity_score: 0.94,
            },
            {
              source_id: 'src_2',
              title: 'Internal University Syllabus',
              url: 'javascript:alert(1)', // Unsafe URL must not be a link
              similarity_score: 0.82,
            },
          ],
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Verified Curriculum Standards')).toBeDefined();
    expect(screen.getByText('94% Match')).toBeDefined();

    // Verify safe link has valid href
    const safeLink = screen.getByRole('link', { name: /AICTE Handbook 2024/i });
    expect(safeLink.getAttribute('href')).toBe('https://aicte-india.org/handbook');
    expect(safeLink.getAttribute('target')).toBe('_blank');
    expect(safeLink.getAttribute('rel')).toContain('noopener');

    // Verify unsafe link is rendered only as text, not a clickable anchor
    expect(screen.queryByRole('link', { name: /Internal University Syllabus/i })).toBeNull();
    expect(screen.getByText('Internal University Syllabus')).toBeDefined();
  });

  it('renders LimitationNoticeBlock with withheld fields disclosure', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'limitation_notice',
          title: 'Notice: Data Limitation',
          message: 'Institutional cutoffs are withheld due to lack of verified documents.',
          missing_fields: ['jee_advanced_cutoffs', 'median_ctc'],
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Notice: Data Limitation')).toBeDefined();
    expect(
      screen.getByText('Institutional cutoffs are withheld due to lack of verified documents.')
    ).toBeDefined();
    expect(screen.getByText('jee_advanced_cutoffs')).toBeDefined();
    expect(screen.getByText('median_ctc')).toBeDefined();
  });

  it('renders ChartBlockPreview integration point for bar, line, and multi-series charts', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'chart_bar',
          title: 'Placement Distribution',
          data: [
            { label: 'Product Tech', value: 75 },
            { label: 'FinTech', value: 45 },
          ],
          unit: '%',
          source_note: 'Audited College Report 2024',
        },
        {
          type: 'chart_line',
          title: 'Demand Trends Over Time',
          data: [
            { label: '2022', value: 60 },
            { label: '2023', value: 85 },
          ],
          x_label: 'Year',
          y_label: 'Index',
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getAllByText('Placement Distribution').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Product Tech').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Demand Trends Over Time').length).toBeGreaterThan(0);
    expect(screen.getByText(/Audited College Report 2024/i)).toBeDefined();
  });

  it('handles follow-up questions and quick replies and dispatches onActionClick', () => {
    const onAction = vi.fn();
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'follow_up_questions',
          questions: ['Do you prefer private or government colleges?'],
        },
        {
          type: 'quick_replies',
          options: [
            { label: 'Govt Colleges (IIT/NIT)', payload: 'prefer_govt', category: 'preference' },
            { label: 'Top Private Universities', payload: 'prefer_pvt', category: 'preference' },
          ],
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} onActionClick={onAction} />);

    const followUpBtn = screen.getByText('Do you prefer private or government colleges?');
    fireEvent.click(followUpBtn);
    expect(onAction).toHaveBeenCalledWith('Do you prefer private or government colleges?');

    const quickReplyBtn = screen.getByText('Govt Colleges (IIT/NIT)');
    fireEvent.click(quickReplyBtn);
    expect(onAction).toHaveBeenCalledWith('prefer_govt');
  });

  it('safely handles unknown block types and malformed payloads without crashing', () => {
    const malformedBlock: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        // @ts-expect-error testing model-hallucinated block
        { type: 'unsupported_hallucinated_widget', foo: 'bar' },
        // @ts-expect-error testing null block in array
        null,
        { type: 'text', text: 'Survived gracefully.' },
      ],
    };

    render(<StructuredBlockRenderer block={malformedBlock} />);

    expect(screen.getByText('Survived gracefully.')).toBeDefined();
  });

  it('handles unsupported version and legacy blocks gracefully', () => {
    const legacyBlock: StructuredBlock = {
      type: 'rag_evidence',
      title: 'Legacy Citations',
      version: '2.5', // unsupported version
      data: {
        summary: 'Legacy summary text.',
        items: ['Source A', 'Source B'],
      },
    };

    render(<StructuredBlockRenderer block={legacyBlock} />);

    expect(screen.getByText(/Legacy Citations/i)).toBeDefined();
    expect(screen.getByText('Legacy summary text.')).toBeDefined();
    expect(screen.getByText('Source A')).toBeDefined();
  });

  it('renders advantages vs disadvantages comparison table with structured trade-offs', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'comparison_table',
          title: 'Advantages vs. Disadvantages Comparison',
          headers: ['Dimension / Aspect', 'Key Advantages', 'Trade-Offs & Limitations'],
          rows: [
            ['Curriculum Depth & Foundation', 'Deep theoretical understanding and formal degree recognition.', 'Longer duration (3-4 years) and delayed earnings.'],
            ['Skill Application & Agility', 'Hands-on practical projects and fast execution.', 'Requires strong self-directed portfolio evidence.'],
          ],
          summary_verdict: 'Choose accredited depth for formal credentials, or focused practical skills for rapid market entry.',
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Advantages vs. Disadvantages Comparison')).toBeDefined();
    expect(screen.getByText('Dimension / Aspect')).toBeDefined();
    expect(screen.getByText('Key Advantages')).toBeDefined();
    expect(screen.getByText('Trade-Offs & Limitations')).toBeDefined();
    expect(screen.getByText('Curriculum Depth & Foundation')).toBeDefined();
    expect(screen.getByText(/Choose accredited depth/)).toBeDefined();
  });

  it('renders recommendation cards with eligibility, duration, cost, and opportunities', () => {
    const block: StructuredBlock = {
      type: 'counselling_response',
      version: '1.0',
      blocks: [
        {
          type: 'recommendation_card',
          title: 'Electrician Trade (NSQF Level 4)',
          description: '**Eligibility:** 10th Pass with Science & Math | **Duration:** 2 Years | **Cost:** ₹5,000–₹25,000 | **Career Opportunities:** State power utilities, electrical contracting.',
          reasoning: 'Consistent regional employment demand.',
          risks_and_limitations: 'Strict physical safety adherence required.',
          priority: 'high',
          action_label: 'View Trade Syllabus',
        },
      ],
    };

    render(<StructuredBlockRenderer block={block} />);

    expect(screen.getByText('Electrician Trade (NSQF Level 4)')).toBeDefined();
    expect(screen.getByText(/Eligibility:/)).toBeDefined();
    expect(screen.getByText(/Duration:/)).toBeDefined();
    expect(screen.getByText(/Cost:/)).toBeDefined();
    expect(screen.getByText(/Career Opportunities:/)).toBeDefined();
  });
});

