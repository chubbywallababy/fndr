import { normalizeWhitespace, cleanForAddressExtraction } from './text-normalizer';

describe('text-normalizer', () => {
  describe('normalizeWhitespace', () => {
    it('should collapse multiple spaces into one', () => {
      expect(normalizeWhitespace('hello    world')).toBe('hello world');
    });

    it('should replace newlines with spaces', () => {
      expect(normalizeWhitespace('hello\nworld')).toBe('hello world');
    });

    it('should handle carriage returns', () => {
      expect(normalizeWhitespace('hello\r\nworld')).toBe('hello world');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
    });
  });

  describe('cleanForAddressExtraction', () => {
    it('should normalize comma spacing', () => {
      expect(cleanForAddressExtraction('Lexington,KY')).toBe('Lexington, KY');
    });

    it('should collapse multiple spaces', () => {
      expect(cleanForAddressExtraction('123   Main   St')).toBe('123 Main St');
    });

    it('should trim whitespace', () => {
      expect(cleanForAddressExtraction('  123 Main St  ')).toBe('123 Main St');
    });
  });
});
