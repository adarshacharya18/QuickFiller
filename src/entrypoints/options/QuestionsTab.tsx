import React, { useState } from 'react';
import { CheckCircle, HelpCircle, Plus, Trash2, Tag, ShieldCheck } from 'lucide-react';
import { ScreeningWizardAnswers, ScreeningQuestion } from '../../types/questions';

interface QuestionsTabProps {
  wizardAnswers: ScreeningWizardAnswers;
  questionBank: ScreeningQuestion[];
  onSaveQuestions: (wizard: ScreeningWizardAnswers, bank: ScreeningQuestion[]) => void;
}

export const QuestionsTab: React.FC<QuestionsTabProps> = ({
  wizardAnswers,
  questionBank,
  onSaveQuestions,
}) => {
  const [wizard, setWizard] = useState<ScreeningWizardAnswers>(wizardAnswers);
  const [bank, setBank] = useState<ScreeningQuestion[]>(questionBank);

  const addCustomQuestion = () => {
    const newQ: ScreeningQuestion = {
      id: `q_${Date.now()}`,
      category: 'custom',
      questionPrompt: '',
      answer: '',
      tags: [],
      updatedAt: Date.now(),
    };
    setBank((prev) => [...prev, newQ]);
  };

  const updateCustomQuestion = (id: string, partial: Partial<ScreeningQuestion>) => {
    setBank((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...partial, updatedAt: Date.now() } : q))
    );
  };

  const removeCustomQuestion = (id: string) => {
    setBank((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl pb-4">
      {/* Section 1: Standard Screening Wizard */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
            Standard Screening Wizard
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Pre-set answers for ATS work authorization, sponsorship, notice, and salary.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Legally authorized to work in target country?
            </label>
            <select
              value={wizard.authorizedToWork}
              onChange={(e) => setWizard((w) => ({ ...w, authorizedToWork: e.target.value }))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Will you require visa sponsorship?
            </label>
            <select
              value={wizard.requireSponsorship}
              onChange={(e) => setWizard((w) => ({ ...w, requireSponsorship: e.target.value }))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notice Period / Earliest Start Date
            </label>
            <input
              type="text"
              value={wizard.noticePeriod}
              onChange={(e) => setWizard((w) => ({ ...w, noticePeriod: e.target.value }))}
              placeholder="e.g. Immediate, 2 weeks, 30 days"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Desired Compensation / Salary Expectation
            </label>
            <input
              type="text"
              value={wizard.desiredSalary}
              onChange={(e) => setWizard((w) => ({ ...w, desiredSalary: e.target.value }))}
              placeholder="e.g. $130k - $150k or Market Rate"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Open to Relocation?
            </label>
            <select
              value={wizard.openToRelocation}
              onChange={(e) => setWizard((w) => ({ ...w, openToRelocation: e.target.value }))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
            >
              <option value="Remote Only">Remote Only</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Veteran Status (EEO)
            </label>
            <select
              value={wizard.veteranStatus || 'Not a veteran'}
              onChange={(e) => setWizard((w) => ({ ...w, veteranStatus: e.target.value }))}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-sky-500"
            >
              <option value="Not a veteran">I am not a protected veteran</option>
              <option value="Veteran">I identify as a protected veteran</option>
              <option value="Prefer not to say">I don't wish to answer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Custom Question & Answer Bank */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              Approved Q&A Bank
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Saved answers the AI can cite or reuse verbatim in job forms.
            </p>
          </div>
          <button
            onClick={addCustomQuestion}
            className="flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Q&A
          </button>
        </div>

        {bank.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">
            No custom answers saved yet. Add common behavioral or leadership responses here.
          </p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {bank.map((item) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="text"
                    value={item.questionPrompt}
                    onChange={(e) => updateCustomQuestion(item.id, { questionPrompt: e.target.value })}
                    placeholder="Question prompt (e.g. 'Describe your technical leadership style')"
                    className="w-full text-xs font-semibold text-slate-900 bg-transparent border-b border-slate-300 focus:border-sky-600 outline-none pb-1"
                  />
                  <button
                    onClick={() => removeCustomQuestion(item.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={item.answer}
                  onChange={(e) => updateCustomQuestion(item.id, { answer: e.target.value })}
                  placeholder="Your approved answer..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white outline-none resize-y text-slate-700"
                />

                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={item.tags.join(', ')}
                    onChange={(e) =>
                      updateCustomQuestion(item.id, {
                        tags: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Tags (e.g. leadership, conflict, system-design)"
                    className="text-[11px] text-slate-600 bg-transparent border-none outline-none w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 py-3 px-4 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 rounded-b-xl sm:rounded-b-2xl flex items-center justify-between z-20 shadow-sm">
        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[160px] sm:max-w-xs">
          {bank.length} Saved Q&A
        </span>
        <button
          onClick={() => onSaveQuestions(wizard, bank)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
        >
          <CheckCircle className="w-4 h-4" />
          Save Screening Answers
        </button>
      </div>
    </div>
  );
};
