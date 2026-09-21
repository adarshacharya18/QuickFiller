import { StorageData, defaultStorageData } from '../types/storage';
import { CandidateProfile } from '../types/profile';
import { splitPhoneAndExtension } from './phoneUtils';

export function sanitizeProfile(profile: CandidateProfile): CandidateProfile {
  if (!profile || !profile.personal) return profile;

  let lastName = (profile.personal.lastName || '').trim();
  let email = (profile.personal.email || '').trim();
  let phone = (profile.personal.phone || '').trim();
  let phoneExtension = (profile.personal.phoneExtension || '').trim();
  let githubUrl = (profile.personal.githubUrl || '').trim();
  let updated = false;

  // 1. Sanitize lastName if it contains email, phone or multiple tokens
  if (lastName.includes('@') || /\+?\d{7,}/.test(lastName)) {
    const emailMatch = lastName.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !email) {
      email = emailMatch[0];
      updated = true;
    }

    const phoneMatch = lastName.match(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}/
    );
    if (phoneMatch && !phone) {
      phone = phoneMatch[0];
      updated = true;
    }

    const cleanLast = lastName
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,13}/g, '')
      .replace(/[\d+]/g, '')
      .trim();

    if (cleanLast && cleanLast !== lastName) {
      lastName = cleanLast;
      updated = true;
    }
  }

  // 2. Sanitize githubUrl if it points to a repository instead of a profile
  if (githubUrl && githubUrl.includes('github.com')) {
    try {
      const u = new URL(githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`);
      if (u.hostname.replace(/^www\./, '') === 'github.com') {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const username = parts[0];
          const repoName = parts[1];
          const cleanProfileUrl = `https://github.com/${username}`;

          if (profile.portfolioDetails && Array.isArray(profile.portfolioDetails.featuredProjects)) {
            if (!profile.portfolioDetails.featuredProjects.some((p) => p.url?.includes(githubUrl))) {
              profile.portfolioDetails.featuredProjects.push({
                id: `proj_${Date.now()}`,
                title: repoName.replace(/[-_]/g, ' '),
                technologies: [],
                description: '',
                url: githubUrl,
                githubUrl: githubUrl,
              });
            }
          }

          githubUrl = cleanProfileUrl;
          updated = true;
        }
      }
    } catch {}
  }

  // 3. Decouple phone number and extension if phone contains an extension suffix
  if (phone) {
    const { phone: cleanPhone, extension } = splitPhoneAndExtension(phone);
    if (extension && !phoneExtension) {
      phoneExtension = extension;
      phone = cleanPhone;
      updated = true;
    } else if (cleanPhone && cleanPhone !== phone) {
      phone = cleanPhone;
      updated = true;
    }
  }

  // 4. Auto-populate candidate's real resume details if experience or projects are empty
  const isAdarsh =
    email.includes('adarshacharya7830') ||
    profile.personal.firstName.toLowerCase() === 'adarsh' ||
    profile.personal.portfolioUrl?.includes('mriga.adarshacharya');

  let experience = profile.experience || [];
  let education = profile.education || [];
  let skills = profile.skills || [];
  let featuredProjects = profile.portfolioDetails?.featuredProjects || [];
  let city = profile.personal.city || '';
  let portfolioUrl = profile.personal.portfolioUrl || '';
  let linkedinUrl = profile.personal.linkedinUrl || '';

  if (isAdarsh) {
    if (!city) {
      city = 'Pune';
      updated = true;
    }
    if (!linkedinUrl) {
      linkedinUrl = 'https://linkedin.com/in/adarshacharya1842';
      updated = true;
    }
    if (!portfolioUrl) {
      portfolioUrl = 'https://mriga.adarshacharya.workers.dev/';
      updated = true;
    }
    if (experience.length === 0) {
      experience = [
        {
          id: 'exp_universaltech_1',
          company: 'Universaltech',
          role: 'Junior Software Developer',
          startDate: 'JUN 2025',
          endDate: 'JUN 2026',
          highlights: [
            'Built a WordPress/Event Espresso attendance confirmation system using configurable cron schedules, wp_mail(), Twilio SMS, Twilio response webhooks and admin-side response tracking.',
            'Developed an admin dashboard to record notification delivery, attendee responses and registration status so event teams could follow up from one WordPress panel.',
            'Built a fuzzy scoring matching algorithm for CSV bulk imports that reconciles student registrations against physical records using weighted field analysis (Email: 70%, Phone: 50%, Names: 40%), auto-approving matches at >=90% and queuing ambiguous matches (>=60%) for manual review.',
            'Customized Event Espresso registration and checkout behavior using WordPress actions, filters and plugin extension points while preserving compatibility with core plugin flows.',
            'Integrated an internal e-sign agreement product with the registration workflow and Google Drive storage for signed agreement documents.',
            'Used Claude with Figma design context to create GlobalSpaces planning documentation, including architecture notes, UI design specs, component specs, user flows and landing-page plans.',
          ],
        },
        {
          id: 'exp_universaltech_2',
          company: 'Universaltech',
          role: 'Software Developer Intern',
          startDate: 'JAN 2025',
          endDate: 'JUN 2025',
          highlights: [
            'Completed training in Git/GitHub workflows, Agile development frameworks, and WordPress core architecture including actions, filters, and plugin extension lifecycle events.',
          ],
        },
      ];
      updated = true;
    }

    if (
      featuredProjects.length === 0 ||
      !featuredProjects.some((p) => p.title.toLowerCase().includes('spic'))
    ) {
      featuredProjects = [
        {
          id: 'proj_spic_copilot',
          title: 'Spic – Native Low-Latency Linux Voice Copilot',
          technologies: ['Python', 'PipeWire', 'faster-whisper', 'Linux Kernel', '/dev/uinput', 'Wayland'],
          description:
            'Engineered an ultra-low latency (<300ms) background daemon in Python for 100% local speech-to-text processing using PipeWire raw PCM streaming, energy-based VAD, and CPU-quantized faster-whisper. Bypassed Wayland desktop sandboxing by building a Linux Kernel /dev/uinput virtual hardware keyboard driver, enabling direct keystroke injection at 1.5ms/char with a hands-free "Tap-to-Start, Action-to-Finish" activity watcher.',
          url: 'https://github.com/adarshacharya18/spic-voice-copilot',
          githubUrl: 'https://github.com/adarshacharya18/spic-voice-copilot',
        },
        {
          id: 'proj_leetcode_pipeline',
          title: 'Automated LeetCode Video Generation Pipeline',
          technologies: ['Python', 'FFmpeg', 'Manim', 'YouTube API', 'LLM'],
          description:
            'Built an automated video production engine in Python that translates coding submissions into animated YouTube tutorials using LLM-driven scripting and programmatic Manim scene generation. Engineered an audio-visual timestamp syncing scheduler using FFmpeg, an automated YouTube upload integration, and fault-tolerant pipeline state management validated across 328 tests.',
          url: 'https://github.com/adarshacharya18/youtube-video-rag',
          githubUrl: 'https://github.com/adarshacharya18/youtube-video-rag',
        },
      ];
      updated = true;
    }

    if (education.length === 0) {
      education = [
        {
          id: 'edu_vit_pune',
          institution: 'Vishwakarma Institute of Technology',
          degree: 'Bachelor of Technology in Computer Science',
          fieldOfStudy: 'Computer Science',
          graduationYear: '2024',
          gpa: '8.2 CGPA',
        },
      ];
      updated = true;
    }

    if (skills.length === 0) {
      skills = [
        'C++',
        'PHP',
        'JavaScript',
        'React',
        'Tailwind CSS',
        'WordPress plugin development',
        'Event Espresso',
        'Node.js',
        'REST API',
        'MySQL',
        'PostgreSQL',
        'Python',
        'Linux',
        'Twilio',
        'Docker',
        'Git',
        'GitHub',
      ];
      updated = true;
    }
  }

  if (updated) {
    const cleaned: CandidateProfile = {
      ...profile,
      personal: {
        ...profile.personal,
        city: city || profile.personal.city,
        lastName,
        email,
        phone,
        phoneExtension: phoneExtension || profile.personal.phoneExtension || '',
        githubUrl,
        portfolioUrl: portfolioUrl || profile.personal.portfolioUrl,
        linkedinUrl: linkedinUrl || profile.personal.linkedinUrl,
      },
      skills,
      experience,
      education,
      portfolioDetails: {
        ...profile.portfolioDetails,
        url: portfolioUrl || profile.portfolioDetails?.url,
        featuredProjects,
      },
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ profile: cleaned });
    }
    return cleaned;
  }

  return profile;
}

/**
 * Checks whether the Chrome extension execution context is still valid.
 * Returns false when the extension has been updated, reloaded, or disabled,
 * preventing "Extension context invalidated" uncaught errors.
 */
export function isExtensionValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

export function getStorageData(): Promise<StorageData> {
  if (!isExtensionValid() || !chrome.storage?.local) {
    try {
      // Prevent PII leakage to third-party web pages via window.localStorage (QF-VULN-03)
      if (
        typeof window !== 'undefined' &&
        window.location?.protocol &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
        !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1')
      ) {
        return Promise.resolve(defaultStorageData);
      }
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('quickfiller_storage') : null;
      if (!local) return Promise.resolve(defaultStorageData);
      const parsed = { ...defaultStorageData, ...JSON.parse(local) };
      parsed.profile = sanitizeProfile(parsed.profile);
      return Promise.resolve(parsed);
    } catch {
      return Promise.resolve(defaultStorageData);
    }
  }

  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, (result) => {
        try {
          if (chrome.runtime?.lastError) {
            resolve(defaultStorageData);
            return;
          }
          const rawProfile = result?.profile || defaultStorageData.profile;
          const profile = sanitizeProfile(rawProfile);

          resolve({
            profile,
            wizardAnswers: result?.wizardAnswers || defaultStorageData.wizardAnswers,
            questionBank: result?.questionBank || defaultStorageData.questionBank,
            customPasteBank: result?.customPasteBank || defaultStorageData.customPasteBank,
            llmSettings: result?.llmSettings || defaultStorageData.llmSettings,
            applications: result?.applications || defaultStorageData.applications,
            jobTrackerEnabled: result?.jobTrackerEnabled ?? defaultStorageData.jobTrackerEnabled,
            autoTrackOnSubmit: result?.autoTrackOnSubmit ?? defaultStorageData.autoTrackOnSubmit,
            extensionEnabled: result?.extensionEnabled ?? defaultStorageData.extensionEnabled,
          });
        } catch {
          resolve(defaultStorageData);
        }
      });
    } catch {
      resolve(defaultStorageData);
    }
  });
}

export async function updateStorageData(partial: Partial<StorageData>): Promise<void> {
  if (partial.profile) {
    partial.profile = sanitizeProfile(partial.profile);
  }

  if (!isExtensionValid() || !chrome.storage?.local) {
    try {
      // Prevent writing PII to third-party web page localStorage
      if (
        typeof window !== 'undefined' &&
        window.location?.protocol &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
        !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1')
      ) {
        return;
      }
      const current = await getStorageData();
      const updated = { ...current, ...partial };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('quickfiller_storage', JSON.stringify(updated));
      }
    } catch {
      // Ignore fallback errors
    }
    return;
  }

  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(partial, () => {
        if (chrome.runtime?.lastError) {
          resolve();
          return;
        }
        resolve();
      });
    } catch {
      resolve();
    }
  });
}
