import {
  classifyLead,
  createClassifiedLead,
  generateLookupLinks,
  LeadClassification,
  ClassifiedLead,
} from './lead-classifier';
import { LisPendensParseResult, PlaintiffInfo, DefendantInfo } from '../parsers/lis-pendens-parser';
import { ParsedAddress } from '../parsers/address-parser';

// Helper to create mock parse results
function createMockParseResult(overrides: Partial<LisPendensParseResult> = {}): LisPendensParseResult {
  const defaultPlaintiff: PlaintiffInfo = {
    name: 'Wells Fargo Bank',
    type: 'bank',
    isGoodLead: true,
    concerns: [],
  };

  const defaultDefendant: DefendantInfo = {
    name: 'John Doe',
    type: 'individual',
    isGoodLead: true,
  };

  const defaultAddress: ParsedAddress = {
    raw: '123 Main St, Lexington, KY 40508',
    cleaned: '123 Main St, Lexington, KY 40508',
    score: 90,
    quality: 'high',
    isLikelyAddress: true,
    reasons: [],
  };

  return {
    plaintiff: defaultPlaintiff,
    defendant: defaultDefendant,
    propertyAddress: defaultAddress,
    mailingAddress: null,
    allAddresses: [defaultAddress],
    rawText: 'Mock document text',
    ...overrides,
  };
}

describe('lead-classifier', () => {
  describe('generateLookupLinks', () => {
    it('should generate PVA link with defendant name', () => {
      const address: ParsedAddress = {
        raw: '123 Main St',
        cleaned: '123 Main St',
        score: 70,
        quality: 'medium',
        isLikelyAddress: true,
        reasons: [],
      };

      const links = generateLookupLinks(address, 'John Doe');

      expect(links.pva).toContain('fayettepva.com');
      expect(links.pva).toContain('John%20Doe');
    });

    it('should generate Zillow link with address', () => {
      const address: ParsedAddress = {
        raw: '123 Main St',
        cleaned: '123 Main St',
        score: 70,
        quality: 'medium',
        isLikelyAddress: true,
        reasons: [],
      };

      const links = generateLookupLinks(address, 'John Doe');

      expect(links.zillow).toContain('zillow.com');
      expect(links.zillow).toContain('123%20Main%20St');
    });

    it('should generate Google Maps link with address', () => {
      const address: ParsedAddress = {
        raw: '123 Main St',
        cleaned: '123 Main St',
        score: 70,
        quality: 'medium',
        isLikelyAddress: true,
        reasons: [],
      };

      const links = generateLookupLinks(address, 'John Doe');

      expect(links.googleMaps).toContain('google.com/maps');
      expect(links.googleMaps).toContain('123%20Main%20St');
    });

    it('should handle null address gracefully', () => {
      const links = generateLookupLinks(null, 'John Doe');

      expect(links.pva).toContain('John%20Doe');
      expect(links.zillow).toBeDefined();
      expect(links.googleMaps).toBeDefined();
    });
  });

  describe('classifyLead', () => {
    describe('Level 1 (Plaintiff)', () => {
      it('should mark bank plaintiff as good', () => {
        const parseResult = createMockParseResult({
          plaintiff: {
            name: 'Wells Fargo Bank',
            type: 'bank',
            isGoodLead: true,
            concerns: [],
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level1.score).toBe('good');
      });

      it('should mark HOA plaintiff as bad and stop', () => {
        const parseResult = createMockParseResult({
          plaintiff: {
            name: 'Oakwood HOA',
            type: 'hoa',
            isGoodLead: false,
            concerns: [],
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level1.score).toBe('bad');
        expect(classification.overallScore).toBe('bad');
        expect(classification.stopReason).toContain('Level 1');
      });

      it('should mark government plaintiff as bad and stop', () => {
        const parseResult = createMockParseResult({
          plaintiff: {
            name: 'Fayette County',
            type: 'government',
            isGoodLead: false,
            concerns: [],
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level1.score).toBe('bad');
        expect(classification.overallScore).toBe('bad');
      });
    });

    describe('Level 2 (Defendant)', () => {
      it('should mark individual defendant as good', () => {
        const parseResult = createMockParseResult({
          defendant: {
            name: 'John Doe',
            type: 'individual',
            isGoodLead: true,
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level2.score).toBe('good');
      });

      it('should mark LLC defendant as bad and stop', () => {
        const parseResult = createMockParseResult({
          defendant: {
            name: 'ABC Properties LLC',
            type: 'llc',
            isGoodLead: false,
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level2.score).toBe('bad');
        expect(classification.overallScore).toBe('bad');
        expect(classification.stopReason).toContain('Level 2');
      });

      it('should mark trust defendant as good', () => {
        const parseResult = createMockParseResult({
          defendant: {
            name: 'John Doe, Trustee',
            type: 'trust',
            isGoodLead: true,
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level2.score).toBe('good');
      });
    });

    describe('Level 3 (Equity/Purchase Date)', () => {
      it('should return needs_lookup when no purchase date provided', () => {
        const parseResult = createMockParseResult();
        const classification = classifyLead(parseResult);

        expect(classification.level3.score).toBe('needs_lookup');
      });

      it('should mark 5+ years ownership as good', () => {
        const parseResult = createMockParseResult();
        const sixYearsAgo = new Date();
        sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

        const classification = classifyLead(parseResult, {
          purchaseDate: sixYearsAgo,
        });

        expect(classification.level3.score).toBe('good');
        expect(classification.level3.yearsOwned).toBeGreaterThanOrEqual(5);
      });

      it('should mark <5 years ownership as bad', () => {
        const parseResult = createMockParseResult();
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const classification = classifyLead(parseResult, {
          purchaseDate: twoYearsAgo,
        });

        expect(classification.level3.score).toBe('bad');
        expect(classification.level3.yearsOwned).toBeLessThan(5);
      });
    });

    describe('Level 4 (Property Quality)', () => {
      it('should return needs_lookup when no property data provided', () => {
        const parseResult = createMockParseResult();
        const classification = classifyLead(parseResult);

        expect(classification.level4.score).toBe('needs_lookup');
      });

      it('should mark B- or better neighborhood as good', () => {
        const parseResult = createMockParseResult();

        const classification = classifyLead(parseResult, {
          neighborhoodGrade: 'B',
        });

        expect(classification.level4.score).toBe('good');
      });

      it('should mark C+ or worse neighborhood as bad', () => {
        const parseResult = createMockParseResult();

        const classification = classifyLead(parseResult, {
          neighborhoodGrade: 'C+',
        });

        expect(classification.level4.score).toBe('bad');
      });

      it('should consider 3-5 bedrooms as good', () => {
        const parseResult = createMockParseResult();

        const classification = classifyLead(parseResult, {
          bedCount: 4,
        });

        expect(classification.level4.score).toBe('good');
        expect(classification.level4.bedCount).toBe(4);
      });
    });

    describe('Overall Score', () => {
      it('should be good when all levels pass', () => {
        const parseResult = createMockParseResult();
        const sixYearsAgo = new Date();
        sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

        const classification = classifyLead(parseResult, {
          purchaseDate: sixYearsAgo,
          neighborhoodGrade: 'B+',
          bedCount: 4,
        });

        expect(classification.overallScore).toBe('good');
      });

      it('should be review when level 3/4 need lookup', () => {
        const parseResult = createMockParseResult();
        const classification = classifyLead(parseResult);

        // Level 1 and 2 are good, but 3 and 4 need lookup
        expect(classification.overallScore).toBe('review');
      });

      it('should be bad when level 1 fails', () => {
        const parseResult = createMockParseResult({
          plaintiff: {
            name: 'City of Lexington',
            type: 'government',
            isGoodLead: false,
            concerns: [],
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.overallScore).toBe('bad');
      });

      it('should be bad when level 2 fails', () => {
        const parseResult = createMockParseResult({
          defendant: {
            name: 'XYZ Holdings LLC',
            type: 'llc',
            isGoodLead: false,
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.overallScore).toBe('bad');
      });
    });

    describe('Early Termination', () => {
      it('should skip level 2-4 when level 1 is bad', () => {
        const parseResult = createMockParseResult({
          plaintiff: {
            name: 'Sunset HOA',
            type: 'hoa',
            isGoodLead: false,
            concerns: [],
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level2.note).toContain('Skipped');
        expect(classification.level3.note).toContain('Skipped');
        expect(classification.level4.note).toContain('Skipped');
      });

      it('should skip level 3-4 when level 2 is bad', () => {
        const parseResult = createMockParseResult({
          defendant: {
            name: 'Investment Corp',
            type: 'llc',
            isGoodLead: false,
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.level3.note).toContain('Skipped');
        expect(classification.level4.note).toContain('Skipped');
      });
    });

    describe('Concerns', () => {
      it('should preserve plaintiff concerns', () => {
        const parseResult = createMockParseResult({
          plaintiff: {
            name: 'Wells Fargo and US Bank',
            type: 'bank',
            isGoodLead: true,
            concerns: ['Multiple plaintiffs - potential second mortgage'],
          },
        });

        const classification = classifyLead(parseResult);

        expect(classification.concerns).toContain('Multiple plaintiffs - potential second mortgage');
      });
    });
  });

  describe('createClassifiedLead', () => {
    it('should create a complete classified lead object', () => {
      const parseResult = createMockParseResult();

      const lead = createClassifiedLead('test-123', 'http://example.com/doc.pdf', parseResult);

      expect(lead.id).toBe('test-123');
      expect(lead.pdfUrl).toBe('http://example.com/doc.pdf');
      expect(lead.plaintiff).toBeDefined();
      expect(lead.defendant).toBeDefined();
      expect(lead.classification).toBeDefined();
      expect(lead.lookupLinks).toBeDefined();
    });

    it('should include lookup links', () => {
      const parseResult = createMockParseResult();

      const lead = createClassifiedLead('test-123', undefined, parseResult);

      expect(lead.lookupLinks.pva).toBeDefined();
      expect(lead.lookupLinks.zillow).toBeDefined();
      expect(lead.lookupLinks.googleMaps).toBeDefined();
    });

    it('should optionally include raw text', () => {
      const parseResult = createMockParseResult({ rawText: 'Full document text here' });

      const leadWithText = createClassifiedLead('test-1', undefined, parseResult, undefined, true);
      const leadWithoutText = createClassifiedLead('test-2', undefined, parseResult, undefined, false);

      expect(leadWithText.rawText).toBe('Full document text here');
      expect(leadWithoutText.rawText).toBeUndefined();
    });
  });
});
