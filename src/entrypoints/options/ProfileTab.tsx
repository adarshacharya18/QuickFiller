import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Link2,
  Plus,
  Trash2,
  CheckCircle,
  ExternalLink,
  Briefcase,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { CandidateProfile, ProjectItem, ExperienceItem, EducationItem } from '../../types/profile';
import { parseResumePdf } from '../../utils/pdfParser';

interface ProfileTabProps {
  profile: CandidateProfile;
  onSaveProfile: (profile: CandidateProfile) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ profile, onSaveProfile }) => {
  const [formData, setFormData] = useState<CandidateProfile>(profile);
  const [isParsing, setIsParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseNotice(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = await parseResumePdf(buffer);

      setFormData((prev) => ({
        ...prev,
        personal: {
          ...prev.personal,
          firstName: result.suggestedProfile.personal?.firstName || prev.personal.firstName,
          lastName: result.suggestedProfile.personal?.lastName || prev.personal.lastName,
          email: result.suggestedProfile.personal?.email || prev.personal.email,
          phone: result.suggestedProfile.personal?.phone || prev.personal.phone,
          linkedinUrl: result.suggestedProfile.personal?.linkedinUrl || prev.personal.linkedinUrl,
          githubUrl: result.suggestedProfile.personal?.githubUrl || prev.personal.githubUrl,
          portfolioUrl: result.suggestedProfile.personal?.portfolioUrl || prev.personal.portfolioUrl,
        },
        summary: result.suggestedProfile.summary || prev.summary,
        extractedLinks: result.extractedLinks,
        portfolioDetails: {
          ...prev.portfolioDetails,
          url: result.suggestedProfile.personal?.portfolioUrl || prev.portfolioDetails.url,
        },
        updatedAt: Date.now(),
      }));

      setParseNotice(
        `Successfully extracted text and found ${result.extractedLinks.length} embedded links!`
      );
    } catch (err: any) {
      alert(`Failed to parse PDF resume: ${err.message || 'Unknown error'}`);
    } finally {
      setIsParsing(false);
    }
  };

  const addProject = () => {
    const newProj: ProjectItem = {
      id: `proj_${Date.now()}`,
      title: '',
      technologies: [],
      description: '',
      url: '',
      githubUrl: '',
    };
    setFormData((prev) => ({
      ...prev,
      portfolioDetails: {
        ...prev.portfolioDetails,
        featuredProjects: [...prev.portfolioDetails.featuredProjects, newProj],
      },
    }));
  };

  const removeProject = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      portfolioDetails: {
        ...prev.portfolioDetails,
        featuredProjects: prev.portfolioDetails.featuredProjects.filter((p) => p.id !== id),
      },
    }));
  };

  const updateProject = (id: string, partial: Partial<ProjectItem>) => {
    setFormData((prev) => ({
      ...prev,
      portfolioDetails: {
        ...prev.portfolioDetails,
        featuredProjects: prev.portfolioDetails.featuredProjects.map((p) =>
          p.id === id ? { ...p, ...partial } : p
        ),
      },
    }));
  };

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      {/* Top Banner: Resume Upload */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              Upload & Parse Resume (PDF)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Extracts text and embedded hyperlinks (LinkedIn, GitHub, Portfolio) locally on your device.
            </p>
          </div>
          <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm">
            <UploadCloud className="w-4 h-4 text-sky-400" />
            {isParsing ? 'Parsing Resume...' : 'Choose PDF Resume'}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isParsing}
            />
          </label>
        </div>

        {parseNotice && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{parseNotice}</span>
          </div>
        )}

        {/* Extracted Links Badge List */}
        {formData.extractedLinks && formData.extractedLinks.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-sky-600" />
              Extracted Hyperlinks from Resume:
            </h4>
            <div className="flex flex-wrap gap-2">
              {formData.extractedLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition border border-slate-200"
                >
                  <span className="font-semibold text-slate-900 capitalize">
                    {link.category}:
                  </span>
                  <span className="truncate max-w-[200px]">{link.url}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Personal Details */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Personal & Contact Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
            <input
              type="text"
              value={formData.personal.firstName}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, firstName: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
            <input
              type="text"
              value={formData.personal.lastName}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, lastName: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={formData.personal.email}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, email: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.personal.phone}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, phone: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">City / Location</label>
            <input
              type="text"
              placeholder="e.g. San Francisco, CA"
              value={formData.personal.city}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, city: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Portfolio URL</label>
            <input
              type="url"
              placeholder="https://yourportfolio.dev"
              value={formData.personal.portfolioUrl || ''}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, portfolioUrl: e.target.value },
                  portfolioDetails: { ...p.portfolioDetails, url: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">GitHub URL</label>
            <input
              type="url"
              placeholder="https://github.com/username"
              value={formData.personal.githubUrl || ''}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, githubUrl: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">LinkedIn URL</label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/username"
              value={formData.personal.linkedinUrl || ''}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  personal: { ...p.personal, linkedinUrl: e.target.value },
                }))
              }
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Professional Summary</label>
          <textarea
            rows={3}
            value={formData.summary}
            onChange={(e) => setFormData((p) => ({ ...p, summary: e.target.value }))}
            placeholder="Concise overview of your experience and specialties..."
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Skills (comma separated)
          </label>
          <input
            type="text"
            value={formData.skills.join(', ')}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                skills: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="TypeScript, React, Python, Go, Docker, PostgreSQL"
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
          />
        </div>
      </div>

      {/* Section 2: Portfolio Projects */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              Portfolio Projects Context
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Highlight key projects so the AI can cite concrete technical achievements when answering screening questions.
            </p>
          </div>
          <button
            onClick={addProject}
            className="flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Project
          </button>
        </div>

        {formData.portfolioDetails.featuredProjects.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">
            No featured projects yet. Click 'Add Project' to teach the LLM about your best work.
          </p>
        ) : (
          <div className="space-y-4">
            {formData.portfolioDetails.featuredProjects.map((proj) => (
              <div
                key={proj.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={proj.title}
                    onChange={(e) => updateProject(proj.id, { title: e.target.value })}
                    placeholder="Project Title (e.g. Distributed Task Queue)"
                    className="font-medium text-xs text-slate-900 bg-transparent border-b border-slate-300 focus:border-sky-600 outline-none pb-1 w-2/3"
                  />
                  <button
                    onClick={() => removeProject(proj.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Live Demo / URL</label>
                    <input
                      type="url"
                      value={proj.url || ''}
                      onChange={(e) => updateProject(proj.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Technologies Used</label>
                    <input
                      type="text"
                      value={proj.technologies.join(', ')}
                      onChange={(e) =>
                        updateProject(proj.id, {
                          technologies: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Go, Redis, gRPC"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Description & Key Challenges Solved
                  </label>
                  <textarea
                    rows={2}
                    value={proj.description}
                    onChange={(e) => updateProject(proj.id, { description: e.target.value })}
                    placeholder="Built a fault-tolerant job queue handling 10k req/sec with zero packet loss..."
                    className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none resize-y"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Save Button Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex items-center justify-end max-w-5xl mx-auto z-50">
        <button
          onClick={() => onSaveProfile(formData)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Save Profile Changes
        </button>
      </div>
    </div>
  );
};
