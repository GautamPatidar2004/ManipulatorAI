import React from 'react';
import { Compass, Sparkles, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

interface EmptyStateProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

const STARTER_PROMPTS = [
  {
    title: 'Career Pivot Strategy',
    description: 'Transitioning from non-tech to product management or software architecture',
    prompt: 'I am planning a career transition into tech. What skills and milestones should I prioritize?',
  },
  {
    title: 'Resume & Strength Audit',
    description: 'Evaluate technical leadership experience and highlight key achievements',
    prompt: 'How can I best present my technical leadership and project impact on my resume?',
  },
  {
    title: 'Market Skill Demand',
    description: 'Discover trending competencies for AI engineering and cloud systems',
    prompt: 'What are the most valuable technical competencies for AI and systems roles in 2026?',
  },
  {
    title: 'Interview & Negotiation Prep',
    description: 'Prepare strategic answers for behavioral and systems leadership rounds',
    prompt: 'Can you help me prepare talking points for a senior technology interview round?',
  },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt, disabled }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 sm:px-6 max-w-2xl mx-auto text-center my-auto">
      {/* Hero Badge */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-50 to-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
          <Compass size={32} />
        </div>
        <Sparkles size={18} className="absolute -top-1.5 -right-1.5 text-amber-500" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
        CareerCompass AI
      </h2>
      <p className="text-sm sm:text-base text-slate-500 max-w-lg leading-relaxed">
        Your confidential, structured guide for career progression, skill mapping, and strategic transitions.
      </p>

      <div className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-xs">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>Professional & Evidence-Based Guidance • Confidential Sessions</span>
      </div>

      {/* Starter Prompts */}
      <div className="w-full mt-8">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          <HelpCircle size={14} />
          <span>Suggested Consultation Topics</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {STARTER_PROMPTS.map((item, index) => (
            <button
              key={index}
              type="button"
              className="group flex flex-col text-left p-4 bg-white border border-slate-200 hover:border-blue-500 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
              onClick={() => onSelectPrompt(item.prompt)}
              disabled={disabled}
            >
              <div className="flex items-center justify-between mb-1.5 w-full">
                <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </span>
                <ArrowRight size={14} className="text-blue-600 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
              <p className="text-xs text-slate-500 leading-normal">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
