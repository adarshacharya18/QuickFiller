export interface ProjectItem {
  id: string;
  title: string;
  role?: string;
  technologies: string[];
  description: string;
  url?: string;
  githubUrl?: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  location?: string;
  startDate: string;
  endDate: string; // e.g. "Present" or "2024-05"
  highlights: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  graduationYear: string;
  gpa?: string;
}

export interface ExtractedLink {
  url: string;
  title?: string;
  category: 'portfolio' | 'github' | 'linkedin' | 'project' | 'other';
}

export interface CandidateProfile {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    state?: string;
    country?: string;
    postalCode?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    twitterUrl?: string;
  };
  summary: string;
  skills: string[];
  portfolioDetails: {
    url: string;
    bio?: string;
    featuredProjects: ProjectItem[];
  };
  experience: ExperienceItem[];
  education: EducationItem[];
  extractedLinks: ExtractedLink[];
  rawResumeText?: string;
  updatedAt: number;
}

export const defaultProfile: CandidateProfile = {
  personal: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    twitterUrl: '',
  },
  summary: '',
  skills: [],
  portfolioDetails: {
    url: '',
    bio: '',
    featuredProjects: [],
  },
  experience: [],
  education: [],
  extractedLinks: [],
  rawResumeText: '',
  updatedAt: Date.now(),
};
