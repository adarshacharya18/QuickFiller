import { describe, it, expect } from 'vitest';
import {
  splitPhoneAndExtension,
  cleanPhoneNumber,
  extractPhoneExtension,
} from '../src/utils/phoneUtils';
import { resolveStandardFieldValue } from '../src/utils/autofill';
import { CandidateProfile, defaultProfile } from '../src/types/profile';
import { DetectedField } from '../src/utils/scanner';

describe('Phone and Extension Engine (phoneUtils & resolveStandardFieldValue)', () => {
  describe('Phone and Extension Splitting (splitPhoneAndExtension)', () => {
    it('splits US phone format with "ext. 101"', () => {
      const { phone, extension } = splitPhoneAndExtension('+1 (555) 123-4567 ext. 101');
      expect(phone).toBe('+1 (555) 123-4567');
      expect(extension).toBe('101');
    });

    it('splits phone format with "ext 123"', () => {
      const { phone, extension } = splitPhoneAndExtension('9876543210 ext 123');
      expect(phone).toBe('9876543210');
      expect(extension).toBe('123');
    });

    it('splits phone format with "extension 999"', () => {
      const { phone, extension } = splitPhoneAndExtension('+1 800 555 0199 extension 999');
      expect(phone).toBe('+1 800 555 0199');
      expect(extension).toBe('999');
    });

    it('splits phone format with "x42" and "x 42"', () => {
      const res1 = splitPhoneAndExtension('(123) 456-7890 x42');
      expect(res1.phone).toBe('(123) 456-7890');
      expect(res1.extension).toBe('42');

      const res2 = splitPhoneAndExtension('(123) 456-7890 x 42');
      expect(res2.phone).toBe('(123) 456-7890');
      expect(res2.extension).toBe('42');
    });

    it('splits phone format with "#101"', () => {
      const { phone, extension } = splitPhoneAndExtension('555-123-4567 #101');
      expect(phone).toBe('555-123-4567');
      expect(extension).toBe('101');
    });

    it('splits phone format with comma delimiter: "+91 9876543210, ext. 456"', () => {
      const { phone, extension } = splitPhoneAndExtension('+91 9876543210, ext. 456');
      expect(phone).toBe('+91 9876543210');
      expect(extension).toBe('456');
    });

    it('handles clean phone number without extension', () => {
      const { phone, extension } = splitPhoneAndExtension('+1 (555) 123-4567');
      expect(phone).toBe('+1 (555) 123-4567');
      expect(extension).toBe('');
    });

    it('handles empty or whitespace strings', () => {
      expect(splitPhoneAndExtension('')).toEqual({ phone: '', extension: '' });
      expect(splitPhoneAndExtension('   ')).toEqual({ phone: '', extension: '' });
      expect(splitPhoneAndExtension(null as any)).toEqual({ phone: '', extension: '' });
    });

    it('provides cleanPhoneNumber and extractPhoneExtension helpers', () => {
      expect(cleanPhoneNumber('+1 (555) 123-4567 ext. 42')).toBe('+1 (555) 123-4567');
      expect(extractPhoneExtension('+1 (555) 123-4567 ext. 42')).toBe('42');
      expect(cleanPhoneNumber('9876543210')).toBe('9876543210');
      expect(extractPhoneExtension('9876543210')).toBe('');
    });
  });

  describe('Standard Field Value Resolution (resolveStandardFieldValue)', () => {
    const makeField = (type: any): DetectedField => ({
      id: `field_${type}`,
      element: document.createElement('input'),
      type,
      label: type,
      placeholder: '',
      value: '',
      isTextarea: false,
    });

    it('returns clean phone number without extension when profile phone contains extension', () => {
      const profile: CandidateProfile = {
        ...defaultProfile,
        personal: {
          ...defaultProfile.personal,
          phone: '+1 (555) 123-4567 ext. 101',
        },
      };

      const phoneVal = resolveStandardFieldValue(makeField('phone'), profile);
      expect(phoneVal).toBe('+1 (555) 123-4567');
      expect(phoneVal).not.toContain('101');
      expect(phoneVal).not.toContain('ext');
    });

    it('extracts extension for phoneExtension field from profile phone', () => {
      const profile: CandidateProfile = {
        ...defaultProfile,
        personal: {
          ...defaultProfile.personal,
          phone: '+1 (555) 123-4567 ext. 101',
        },
      };

      const extVal = resolveStandardFieldValue(makeField('phoneExtension'), profile);
      expect(extVal).toBe('101');
      expect(extVal).not.toContain('+1');
    });

    it('prioritizes explicit phoneExtension property in profile if set', () => {
      const profile: CandidateProfile = {
        ...defaultProfile,
        personal: {
          ...defaultProfile.personal,
          phone: '+1 (555) 123-4567',
          phoneExtension: '999',
        },
      };

      const extVal = resolveStandardFieldValue(makeField('phoneExtension'), profile);
      expect(extVal).toBe('999');

      const phoneVal = resolveStandardFieldValue(makeField('phone'), profile);
      expect(phoneVal).toBe('+1 (555) 123-4567');
    });

    it('returns empty string for phoneExtension when candidate has no extension (NEVER returns phone number)', () => {
      const profile: CandidateProfile = {
        ...defaultProfile,
        personal: {
          ...defaultProfile.personal,
          phone: '+1 (555) 123-4567',
          phoneExtension: '',
        },
      };

      const extVal = resolveStandardFieldValue(makeField('phoneExtension'), profile);
      expect(extVal).toBe('');
      expect(extVal).not.toBe(profile.personal.phone);
    });
  });
});
