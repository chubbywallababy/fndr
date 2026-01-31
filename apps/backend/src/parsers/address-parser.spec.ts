import {
  scoreAddressCandidate,
  extractAddressesFromText,
  filterIgnoredAddresses,
  getBestAddress,
  ParsedAddress,
} from './address-parser';

describe('address-parser', () => {
  describe('scoreAddressCandidate', () => {
    it('should score a full Lexington KY address as high quality', () => {
      const result = scoreAddressCandidate('123 Main Street, Lexington, KY 40508');
      
      expect(result.quality).toBe('high');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.isLikelyAddress).toBe(true);
      expect(result.cleaned).toBe('123 Main Street, Lexington, KY 40508');
    });

    it('should score a street-only address as medium quality', () => {
      const result = scoreAddressCandidate('456 Oak Avenue');
      
      expect(result.quality).toBe('medium');
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(80);
      expect(result.isLikelyAddress).toBe(true);
    });

    it('should reject non-address phrases', () => {
      const result = scoreAddressCandidate('filed in circuit court');
      
      expect(result.quality).toBe('low');
      expect(result.score).toBe(0);
      expect(result.isLikelyAddress).toBe(false);
      expect(result.reasons).toContain('matched_non_address_phrase');
    });

    it('should reject text with "south of" directional phrase', () => {
      const result = scoreAddressCandidate('south of Main Street');
      
      expect(result.isLikelyAddress).toBe(false);
      expect(result.reasons).toContain('matched_non_address_phrase');
    });

    it('should give bonus points for Lexington city', () => {
      const withCity = scoreAddressCandidate('123 Main St, Lexington');
      const withoutCity = scoreAddressCandidate('123 Main St, Louisville');
      
      expect(withCity.score).toBeGreaterThan(withoutCity.score);
    });

    it('should give bonus points for KY state', () => {
      const withState = scoreAddressCandidate('123 Main St, KY');
      const withoutState = scoreAddressCandidate('123 Main St, OH');
      
      expect(withState.score).toBeGreaterThan(withoutState.score);
    });

    it('should handle addresses with apartment/unit numbers', () => {
      const result = scoreAddressCandidate('789 Elm Drive, Unit 4B');
      
      expect(result.isLikelyAddress).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should score addresses without leading numbers as low', () => {
      const result = scoreAddressCandidate('Main Street');
      
      expect(result.reasons).toContain('no_leading_street_number');
    });
  });

  describe('extractAddressesFromText', () => {
    it('should extract a single address from text', () => {
      const text = 'The property located at 123 Main Street is for sale.';
      const addresses = extractAddressesFromText(text);
      
      expect(addresses.length).toBeGreaterThanOrEqual(1);
      // The regex may extract abbreviated form (St vs Street)
      expect(addresses[0].cleaned).toContain('123 Main St');
    });

    it('should extract multiple addresses from text', () => {
      const text = `
        Property A: 123 Main Street, Lexington, KY 40508
        Property B: 456 Oak Avenue, Lexington, KY 40509
      `;
      const addresses = extractAddressesFromText(text);
      
      expect(addresses.length).toBeGreaterThanOrEqual(2);
    });

    it('should not duplicate addresses', () => {
      const text = '123 Main Street is great. I love 123 Main Street.';
      const addresses = extractAddressesFromText(text);
      
      // Should only return one unique address
      const uniqueAddresses = new Set(addresses.map(a => a.cleaned));
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    it('should handle text with no addresses', () => {
      const text = 'This is a legal document with no property addresses.';
      const addresses = extractAddressesFromText(text);
      
      expect(addresses.length).toBe(0);
    });

    it('should extract addresses with various street types', () => {
      const streetTypes = ['St', 'Ave', 'Rd', 'Blvd', 'Ln', 'Dr', 'Ct', 'Way'];
      
      for (const type of streetTypes) {
        const text = `Property at 100 Test ${type}`;
        const addresses = extractAddressesFromText(text);
        expect(addresses.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('filterIgnoredAddresses', () => {
    const sampleAddresses: ParsedAddress[] = [
      {
        raw: '123 Main St',
        cleaned: '123 Main St',
        score: 70,
        quality: 'medium',
        isLikelyAddress: true,
        reasons: [],
      },
      {
        raw: '456 Oak Ave',
        cleaned: '456 Oak Ave',
        score: 70,
        quality: 'medium',
        isLikelyAddress: true,
        reasons: [],
      },
    ];

    it('should return all addresses when ignore list is empty', () => {
      const result = filterIgnoredAddresses(sampleAddresses, []);
      expect(result.length).toBe(2);
    });

    it('should return all addresses when ignore list is undefined', () => {
      const result = filterIgnoredAddresses(sampleAddresses, undefined);
      expect(result.length).toBe(2);
    });

    it('should filter out addresses in ignore list', () => {
      const result = filterIgnoredAddresses(sampleAddresses, ['123 Main St']);
      
      expect(result.length).toBe(1);
      expect(result[0].cleaned).toBe('456 Oak Ave');
    });

    it('should be case-insensitive when filtering', () => {
      const result = filterIgnoredAddresses(sampleAddresses, ['123 MAIN ST']);
      
      expect(result.length).toBe(1);
    });
  });

  describe('getBestAddress', () => {
    it('should return null for empty array', () => {
      const result = getBestAddress([]);
      expect(result).toBeNull();
    });

    it('should return the highest scoring address', () => {
      const addresses: ParsedAddress[] = [
        { raw: 'A', cleaned: 'A', score: 50, quality: 'medium', isLikelyAddress: true, reasons: [] },
        { raw: 'B', cleaned: 'B', score: 80, quality: 'high', isLikelyAddress: true, reasons: [] },
        { raw: 'C', cleaned: 'C', score: 30, quality: 'low', isLikelyAddress: false, reasons: [] },
      ];
      
      const result = getBestAddress(addresses);
      
      expect(result).not.toBeNull();
      expect(result!.cleaned).toBe('B');
      expect(result!.score).toBe(80);
    });

    it('should return the first if scores are equal', () => {
      const addresses: ParsedAddress[] = [
        { raw: 'First', cleaned: 'First', score: 70, quality: 'medium', isLikelyAddress: true, reasons: [] },
        { raw: 'Second', cleaned: 'Second', score: 70, quality: 'medium', isLikelyAddress: true, reasons: [] },
      ];
      
      const result = getBestAddress(addresses);
      
      expect(result!.cleaned).toBe('First');
    });
  });
});
