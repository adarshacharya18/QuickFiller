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

    // Security: Validate file type and size constraints
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Security validation: Please upload a valid PDF document (.pdf).');
      e.target.value = '';
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload a PDF under 10MB.`);
      e.target.value = '';
      return;
    }

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
          city: result.suggestedProfile.personal?.city || prev.personal.city,
          linkedinUrl: result.suggestedProfile.personal?.linkedinUrl || prev.personal.linkedinUrl,
          githubUrl: result.suggestedProfile.personal?.githubUrl || prev.personal.githubUrl,
          portfolioUrl: result.suggestedProfile.personal?.portfolioUrl || prev.personal.portfolioUrl,
        },
        summary: result.suggestedProfile.summary || prev.summary,
        skills: result.suggestedProfile.skills?.length ? result.suggestedProfile.skills : prev.skills,
        experience: result.suggestedProfile.experience?.length ? result.suggestedProfile.experience : prev.experience,
        education: result.suggestedProfile.education?.length ? result.suggestedProfile.education : prev.education,
        extractedLinks: result.extractedLinks,
        portfolioDetails: {
          ...prev.portfolioDetails,
          url: result.suggestedProfile.personal?.portfolioUrl || prev.portfolioDetails.url,
          featuredProjects: result.suggestedProfile.portfolioDetails?.featuredProjects?.length
            ? result.suggestedProfile.portfolioDetails.featuredProjects
            : prev.portfolioDetails.featuredProjects,
        },
        rawResumeText: result.rawText,
        updatedAt: Date.now(),
      }));

      setParseNotice(
        `Successfully extracted resume text! Found ${result.suggestedProfile.experience?.length || 0} work experiences, ${result.suggestedProfile.portfolioDetails?.featuredProjects?.length || 0} projects, ${result.suggestedProfile.skills?.length || 0} skills, and ${result.extractedLinks.length} links!`
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

  const addExperience = () => {
    const newExp: ExperienceItem = {
      id: `exp_${Date.now()}`,
      company: '',
      role: '',
      startDate: '',
      endDate: 'Present',
      highlights: [''],
    };
    setFormData((prev) => ({
      ...prev,
      experience: [...prev.experience, newExp],
    }));
  };

  const removeExperience = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }));
  };

  const updateExperience = (id: string, partial: Partial<ExperienceItem>) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    }));
  };

  const addEducation = () => {
    const newEdu: EducationItem = {
      id: `edu_${Date.now()}`,
      institution: '',
      degree: '',
      fieldOfStudy: '',
      graduationYear: '',
      gpa: '',
    };
    setFormData((prev) => ({
      ...prev,
      education: [...prev.education, newEdu],
    }));
  };

  const removeEducation = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.filter((ed) => ed.id !== id),
    }));
  };

  const updateEducation = (id: string, partial: Partial<EducationItem>) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.map((ed) => (ed.id === id ? { ...ed, ...partial } : ed)),
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl pb-4">
      {/* Top Banner: Resume Upload */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              Resume Parser (PDF)
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Extracts profile, experience, skills, and links locally on your device.
            </p>
          </div>
          <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 sm:py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm">
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
          <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-[11px] sm:text-xs">{parseNotice}</span>
          </div>
        )}

        {/* Extracted Links Badge List */}
        {formData.extractedLinks && formData.extractedLinks.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-sky-600" />
              Extracted Hyperlinks:
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {formData.extractedLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition border border-slate-200 max-w-full"
                >
                  <span className="font-semibold text-slate-900 capitalize text-[10px]">
                    {link.category}:
                  </span>
                  <span className="truncate max-w-[140px] sm:max-w-[220px]">{link.url}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Personal Details */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900">Personal & Contact Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              placeholder="e.g. Pune, India or San Francisco, CA"
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
            rows={2}
            value={formData.summary}
            onChange={(e) => setFormData((p) => ({ ...p, summary: e.target.value }))}
            placeholder="Concise overview of your experience and specialties..."
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-y"
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
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              Portfolio Projects
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Highlight key projects so the AI cites accurate technical achievements.
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
          <div className="space-y-3 sm:space-y-4">
            {formData.portfolioDetails.featuredProjects.map((proj) => (
              <div
                key={proj.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 sm:space-y-3"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
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
                    placeholder="Built a fault-tolerant job queue handling 10k req/sec..."
                    className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none resize-y"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Work Experience */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              Work Experience
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Verified roles and companies used by the AI when referencing professional history.
            </p>
          </div>
          <button
            onClick={addExperience}
            className="flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Role
          </button>
        </div>

        {formData.experience.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">
            No work experience added yet. Upload your resume or click 'Add Role'.
          </p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {formData.experience.map((exp) => (
              <div
                key={exp.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 sm:space-y-3"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => updateExperience(exp.id, { company: e.target.value })}
                    placeholder="Company Name (e.g. Universaltech)"
                    className="font-semibold text-xs text-slate-900 bg-transparent border-b border-slate-300 focus:border-sky-600 outline-none pb-1 w-2/3"
                  />
                  <button
                    onClick={() => removeExperience(exp.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Role / Title</label>
                    <input
                      type="text"
                      value={exp.role}
                      onChange={(e) => updateExperience(exp.id, { role: e.target.value })}
                      placeholder="e.g. Junior Software Developer"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Start Date</label>
                    <input
                      type="text"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })}
                      placeholder="e.g. JUN 2025"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">End Date</label>
                    <input
                      type="text"
                      value={exp.endDate}
                      onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })}
                      placeholder="e.g. Present or JUN 2026"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Key Highlights & Responsibilities (one per line)
                  </label>
                  <textarea
                    rows={2}
                    value={(exp.highlights || []).join('\n')}
                    onChange={(e) =>
                      updateExperience(exp.id, {
                        highlights: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Built real-time features...&#10;Optimized queries by 40%..."
                    className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none resize-y"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Education */}
      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              Education
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Degree, university, and academic qualifications.
            </p>
          </div>
          <button
            onClick={addEducation}
            className="flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Education
          </button>
        </div>

        {formData.education.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">
            No education added yet. Upload your resume or click 'Add Education'.
          </p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {formData.education.map((edu) => (
              <div
                key={edu.id}
                className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 sm:space-y-3"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={edu.institution}
                    onChange={(e) => updateEducation(edu.id, { institution: e.target.value })}
                    placeholder="University / Institution"
                    className="font-semibold text-xs text-slate-900 bg-transparent border-b border-slate-300 focus:border-sky-600 outline-none pb-1 w-2/3"
                  />
                  <button
                    onClick={() => removeEducation(edu.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Degree & Field</label>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEducation(edu.id, { degree: e.target.value })}
                      placeholder="e.g. B.Tech in Computer Engineering"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Graduation Year</label>
                    <input
                      type="text"
                      value={edu.graduationYear}
                      onChange={(e) => updateEducation(edu.id, { graduationYear: e.target.value })}
                      placeholder="2025"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">GPA / Score</label>
                    <input
                      type="text"
                      value={edu.gpa || ''}
                      onChange={(e) => updateEducation(edu.id, { gpa: e.target.value })}
                      placeholder="e.g. 8.2 CGPA"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-white outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 py-3 px-4 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 rounded-b-xl sm:rounded-b-2xl flex items-center justify-between z-20 shadow-sm">
        <span className="text-[11px] text-slate-500 font-medium truncate max-w-[160px] sm:max-w-xs">
          {formData.personal.firstName ? `${formData.personal.firstName} ${formData.personal.lastName}` : 'Candidate Profile'}
        </span>
        <button
          onClick={() => onSaveProfile(formData)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
        >
          <CheckCircle className="w-4 h-4" />
          Save Profile
        </button>
      </div>
    </div>
  );
};
