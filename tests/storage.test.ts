import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeProfile, getStorageData, updateStorageData } from '../src/utils/storage';
import { CandidateProfile } from '../src/types/profile';
import { JobApplication } from '../src/types/applications';
import { resetMockChromeStorage } from './setup';

describe('Storage & Profile Data Engine', () => {
  beforeEach(() => {
    resetMockChromeStorage();
  });

  describe('Profile Sanitization (sanitizeProfile)', () => {
    it('cleans corrupted last names that absorbed email and phone from resume parsing', () => {
      const corrupted: CandidateProfile = {
        personal: {
          firstName: 'Adarsh',
          lastName: 'Acharya adarsh@example.com +919876543210',
          email: '',
          phone: '',
        },
      };

      const sanitized = sanitizeProfile(corrupted);

      expect(sanitized.personal.lastName).toBe('Acharya');
      expect(sanitized.personal.email).toBe('adarsh@example.com');
      expect(sanitized.personal.phone).toBe('+919876543210');
    });

    it('sanitizes githubUrl if it accidentally contains a repository path', () => {
      const profile: CandidateProfile = {
        personal: {
          firstName: 'Adarsh',
          githubUrl: 'https://github.com/adarshacharya18/QuickFiller',
        },
      };

      const sanitized = sanitizeProfile(profile);
      expect(sanitized.personal.githubUrl).toBe('https://github.com/adarshacharya18');
    });

    it('preserves clean profiles without alteration', () => {
      const clean: CandidateProfile = {
        personal: {
          firstName: 'Adarsh',
          lastName: 'Acharya',
          email: 'adarsh@example.com',
          phone: '+91 9876543210',
          githubUrl: 'https://github.com/adarshacharya18',
        },
        skills: ['React', 'TypeScript'],
      };

      const sanitized = sanitizeProfile(clean);
      expect(sanitized.personal.lastName).toBe('Acharya');
      expect(sanitized.personal.githubUrl).toBe('https://github.com/adarshacharya18');
    });
  });

  describe('Storage State & Persistence', () => {
    it('returns default storage configuration when storage is empty', async () => {
      const data = await getStorageData();
      expect(data.jobTrackerEnabled).toBe(true);
      expect(data.autoTrackOnSubmit).toBe(true);
      expect(Array.isArray(data.applications)).toBe(true);
      expect(data.applications.length).toBe(0);
    });

    it('updates and persists job applications list', async () => {
      const newApp: JobApplication = {
        id: 'app_1',
        company: 'LeadSquared',
        title: 'Senior Frontend Engineer',
        url: 'https://leadsquaredhrms.darwinbox.in/app/1',
        appliedDate: new Date().toISOString(),
        status: 'Applied',
        updatedAt: new Date().toISOString(),
      };

      await updateStorageData({ applications: [newApp] });

      const updated = await getStorageData();
      expect(updated.applications.length).toBe(1);
      expect(updated.applications[0].company).toBe('LeadSquared');
    });
  });
});
