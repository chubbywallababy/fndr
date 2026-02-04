import {
  sanitizeSlackText,
  truncateSlackText,
  createSectionBlock,
  createHeaderBlock,
  splitIntoSectionBlocks,
  formatLeadsForSlack,
  groupLeadsByScore,
} from './slack';
import { ClassifiedLead } from '../classifiers/lead-classifier';

// Slack limits for validation
const SLACK_LIMITS = {
  HEADER_TEXT: 150,
  SECTION_TEXT: 3000,
  BLOCKS_PER_MESSAGE: 50,
};

// Helper to create mock classified leads
function createMockLead(overrides: Partial<ClassifiedLead> = {}): ClassifiedLead {
  const defaultPlaintiff = {
    name: 'Wells Fargo Bank',
    type: 'bank' as const,
    isGoodLead: true,
    concerns: [],
  };
  
  const defaultDefendant = {
    name: 'John Doe',
    type: 'individual' as const,
    isGoodLead: true,
  };

  return {
    id: 'test-123',
    plaintiff: defaultPlaintiff,
    defendant: defaultDefendant,
    propertyAddress: {
      raw: '123 Main St, Lexington, KY 40508',
      cleaned: '123 Main St, Lexington, KY 40508',
      score: 90,
      quality: 'high',
      isLikelyAddress: true,
      reasons: [],
    },
    mailingAddress: null,
    classification: {
      level1: { score: 'good', plaintiff: defaultPlaintiff, note: 'Bank plaintiff' },
      level2: { score: 'good', defendant: defaultDefendant, note: 'Individual defendant' },
      level3: { score: 'needs_lookup', note: 'No purchase date available' },
      level4: { score: 'needs_lookup', note: 'No property data available' },
      overallScore: 'review',
      concerns: [],
    },
    lookupLinks: {
      pva: 'https://example.com/pva',
      zillow: 'https://example.com/zillow',
      googleMaps: 'https://example.com/maps',
      truePeopleSearch: 'https://example.com/tps',
      fastPeopleSearch: 'https://example.com/fps',
    },
    ...overrides,
  };
}

describe('slack utilities', () => {
  describe('sanitizeSlackText', () => {
    it('should remove degree symbols', () => {
      const result = sanitizeSlackText('Temperature is 72° today');
      expect(result).toBe('Temperature is 72 today');
    });

    it('should remove control characters', () => {
      const result = sanitizeSlackText('Hello\x00World\x1F!');
      expect(result).toBe('HelloWorld!');
    });

    it('should preserve newlines and tabs', () => {
      const result = sanitizeSlackText('Line 1\nLine 2\tTabbed');
      expect(result).toBe('Line 1\nLine 2\tTabbed');
    });

    it('should normalize multiple spaces to single space', () => {
      const result = sanitizeSlackText('Too   many    spaces');
      expect(result).toBe('Too many spaces');
    });

    it('should trim whitespace from lines', () => {
      const result = sanitizeSlackText('  Leading and trailing  \n  Another line  ');
      expect(result).toBe('Leading and trailing\nAnother line');
    });

    it('should handle OCR artifacts like "T° 77 7"', () => {
      const result = sanitizeSlackText('TWILLIAM A. HYERS, etal. T° 77 7');
      expect(result).toBe('TWILLIAM A. HYERS, etal. T 77 7');
      expect(result).not.toContain('°');
    });

    it('should handle empty strings', () => {
      const result = sanitizeSlackText('');
      expect(result).toBe('');
    });
  });

  describe('truncateSlackText', () => {
    it('should return text unchanged if under limit', () => {
      const text = 'Short text';
      const result = truncateSlackText(text, 100);
      expect(result).toBe('Short text');
    });

    it('should truncate text exceeding limit with ellipsis', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = truncateSlackText(text, 20);
      expect(result.length).toBe(20);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should sanitize before truncating', () => {
      const text = 'Text with degree° symbol that is very long and needs truncation';
      const result = truncateSlackText(text, 30);
      expect(result).not.toContain('°');
      expect(result.length).toBeLessThanOrEqual(30);
    });
  });

  describe('createSectionBlock', () => {
    it('should create valid section block structure', () => {
      const block = createSectionBlock('Test content');
      
      expect(block.type).toBe('section');
      expect(block.text.type).toBe('mrkdwn');
      expect(block.text.text).toBe('Test content');
    });

    it('should truncate text exceeding limit', () => {
      const longText = 'A'.repeat(4000);
      const block = createSectionBlock(longText);
      
      expect(block.text.text.length).toBeLessThanOrEqual(SLACK_LIMITS.SECTION_TEXT);
    });

    it('should sanitize text', () => {
      const block = createSectionBlock('Text with ° symbol');
      expect(block.text.text).not.toContain('°');
    });
  });

  describe('createHeaderBlock', () => {
    it('should create valid header block structure', () => {
      const block = createHeaderBlock('Test Header');
      
      expect(block.type).toBe('header');
      expect(block.text.type).toBe('plain_text');
      expect(block.text.text).toBe('Test Header');
      expect(block.text.emoji).toBe(true);
    });

    it('should truncate text exceeding 150 char limit', () => {
      const longText = 'A'.repeat(200);
      const block = createHeaderBlock(longText);
      
      expect(block.text.text.length).toBeLessThanOrEqual(SLACK_LIMITS.HEADER_TEXT);
    });

    it('should allow disabling emoji', () => {
      const block = createHeaderBlock('Test', false);
      expect(block.text.emoji).toBe(false);
    });
  });

  describe('splitIntoSectionBlocks', () => {
    it('should return single block for short text', () => {
      const blocks = splitIntoSectionBlocks('Short text');
      expect(blocks).toHaveLength(1);
    });

    it('should split long text into multiple blocks', () => {
      // Create text longer than 3000 chars
      const lines = Array(100).fill('This is a line of text that takes up some space.');
      const longText = lines.join('\n');
      
      const blocks = splitIntoSectionBlocks(longText);
      
      expect(blocks.length).toBeGreaterThan(1);
      blocks.forEach(block => {
        expect(block.text.text.length).toBeLessThanOrEqual(SLACK_LIMITS.SECTION_TEXT);
      });
    });

    it('should not split in middle of lines', () => {
      const lines = Array(100).fill('Complete line of text here');
      const longText = lines.join('\n');
      
      const blocks = splitIntoSectionBlocks(longText);
      
      blocks.forEach(block => {
        // Each block should have complete lines, not partial
        expect(block.text.text).not.toMatch(/^[a-z]/); // Shouldn't start with lowercase (mid-word)
      });
    });
  });

  describe('groupLeadsByScore', () => {
    it('should group leads correctly by score', () => {
      const leads: ClassifiedLead[] = [
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'good' } }),
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'review' } }),
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'bad' } }),
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'good' } }),
      ];

      const grouped = groupLeadsByScore(leads);

      expect(grouped.good).toHaveLength(2);
      expect(grouped.review).toHaveLength(1);
      expect(grouped.bad).toHaveLength(1);
    });

    it('should handle empty lead array', () => {
      const grouped = groupLeadsByScore([]);

      expect(grouped.good).toHaveLength(0);
      expect(grouped.review).toHaveLength(0);
      expect(grouped.bad).toHaveLength(0);
    });
  });

  describe('formatLeadsForSlack', () => {
    it('should return valid blocks structure', () => {
      const leads = [createMockLead()];
      const { text, blocks } = formatLeadsForSlack(leads);

      expect(text).toBeDefined();
      expect(blocks).toBeInstanceOf(Array);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should not exceed block limit', () => {
      // Create many leads to test block limit
      const leads = Array(30).fill(null).map((_, i) => 
        createMockLead({ 
          id: `test-${i}`,
          classification: { 
            ...createMockLead().classification, 
            overallScore: i % 3 === 0 ? 'good' : i % 3 === 1 ? 'review' : 'bad' 
          } 
        })
      );

      const { blocks } = formatLeadsForSlack(leads);

      expect(blocks.length).toBeLessThanOrEqual(SLACK_LIMITS.BLOCKS_PER_MESSAGE);
    });

    it('should not have any section block exceeding text limit', () => {
      const leads = Array(20).fill(null).map((_, i) => 
        createMockLead({ 
          id: `test-${i}`,
          defendant: { 
            name: `Very Long Name ${i} ${'A'.repeat(100)}`, 
            type: 'individual', 
            isGoodLead: true 
          },
        })
      );

      const { blocks } = formatLeadsForSlack(leads);

      blocks.forEach(block => {
        if (block.type === 'section' && block.text?.text) {
          expect(block.text.text.length).toBeLessThanOrEqual(SLACK_LIMITS.SECTION_TEXT);
        }
        if (block.type === 'header' && block.text?.text) {
          expect(block.text.text.length).toBeLessThanOrEqual(SLACK_LIMITS.HEADER_TEXT);
        }
      });
    });

    it('should sanitize OCR artifacts in lead data', () => {
      const lead = createMockLead({
        defendant: {
          name: 'TWILLIAM A. HYERS, etal. T° 77 7',
          type: 'individual',
          isGoodLead: true,
        },
      });

      const { blocks } = formatLeadsForSlack([lead]);

      // Check that no block contains the degree symbol
      const blockString = JSON.stringify(blocks);
      expect(blockString).not.toContain('°');
    });

    it('should include fallback text', () => {
      const leads = [
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'good' } }),
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'review' } }),
      ];

      const { text } = formatLeadsForSlack(leads);

      expect(text).toContain('1 good');
      expect(text).toContain('1 review');
    });

    it('should handle empty leads array', () => {
      const { text, blocks } = formatLeadsForSlack([]);

      expect(text).toBeDefined();
      expect(blocks).toBeInstanceOf(Array);
    });

    it('should create header block as first element', () => {
      const leads = [createMockLead()];
      const { blocks } = formatLeadsForSlack(leads);

      expect(blocks[0].type).toBe('header');
    });

    it('should include dividers between sections', () => {
      const leads = [
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'good' } }),
        createMockLead({ classification: { ...createMockLead().classification, overallScore: 'review' } }),
      ];

      const { blocks } = formatLeadsForSlack(leads);

      const dividers = blocks.filter(b => b.type === 'divider');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });
});
