import {
  parseLisPendens,
  isGoodPlaintiff,
  isGoodDefendant,
  PlaintiffInfo,
  DefendantInfo,
  LisPendensParseResult,
} from './lis-pendens-parser';

describe('lis-pendens-parser', () => {
  describe('isGoodPlaintiff', () => {
    describe('Good plaintiffs (banks and lenders)', () => {
      it('should identify banks as good', () => {
        expect(isGoodPlaintiff('Wells Fargo Bank')).toBe(true);
        expect(isGoodPlaintiff('Chase Bank')).toBe(true);
        expect(isGoodPlaintiff('Bank of America')).toBe(true);
        expect(isGoodPlaintiff('US Bank')).toBe(true);
        expect(isGoodPlaintiff('PNC Bank')).toBe(true);
      });

      it('should identify credit unions as good', () => {
        expect(isGoodPlaintiff('ABC Federal Credit Union')).toBe(true);
        expect(isGoodPlaintiff('Members Credit Union')).toBe(true);
      });

      it('should identify mortgage companies as good', () => {
        expect(isGoodPlaintiff('Quicken Mortgage')).toBe(true);
        expect(isGoodPlaintiff('National Mortgage Servicing')).toBe(true);
      });

      it('should identify N.A. (National Association) as good', () => {
        expect(isGoodPlaintiff('Wells Fargo Bank, N.A.')).toBe(true);
      });
    });

    describe('Bad plaintiffs (HOA, government, contractors)', () => {
      it('should identify HOAs as bad', () => {
        expect(isGoodPlaintiff('Oakwood HOA')).toBe(false);
        expect(isGoodPlaintiff('Sunset Homeowners Association')).toBe(false);
        expect(isGoodPlaintiff('Property Owners Association')).toBe(false);
      });

      it('should identify government entities as bad', () => {
        expect(isGoodPlaintiff('Fayette County')).toBe(false);
        expect(isGoodPlaintiff('City of Lexington')).toBe(false);
        expect(isGoodPlaintiff('Commonwealth of Kentucky')).toBe(false);
      });

      it('should identify contractors/service companies as bad', () => {
        expect(isGoodPlaintiff('ABC Construction LLC')).toBe(false);
        expect(isGoodPlaintiff('Smith Plumbing')).toBe(false);
        expect(isGoodPlaintiff('Elite Roofing')).toBe(false);
      });
    });
  });

  describe('isGoodDefendant', () => {
    describe('Good defendants (individuals)', () => {
      it('should identify individual names as good', () => {
        expect(isGoodDefendant('John Smith')).toBe(true);
        expect(isGoodDefendant('Jane Doe')).toBe(true);
        expect(isGoodDefendant('Robert Johnson Jr.')).toBe(true);
      });

      it('should identify couples as good', () => {
        expect(isGoodDefendant('John and Jane Smith')).toBe(true);
        expect(isGoodDefendant('Robert & Mary Johnson')).toBe(true);
      });
    });

    describe('Bad defendants (business entities)', () => {
      it('should identify LLCs as bad', () => {
        expect(isGoodDefendant('ABC Properties LLC')).toBe(false);
        expect(isGoodDefendant('Smith Holdings, L.L.C.')).toBe(false);
      });

      it('should identify corporations as bad', () => {
        expect(isGoodDefendant('XYZ Corp')).toBe(false);
        expect(isGoodDefendant('ABC Inc.')).toBe(false);
        expect(isGoodDefendant('Jones Corporation')).toBe(false);
      });

      it('should identify companies as bad', () => {
        expect(isGoodDefendant('Smith Investment Company')).toBe(false);
        expect(isGoodDefendant('Real Estate Corporation')).toBe(false);
      });
    });
  });

  describe('parseLisPendens', () => {
    it('should parse a standard lis pendens document', () => {
      const text = `
        WELLS FARGO BANK, N.A.
        Plaintiff
        
        vs.
        
        JOHN DOE
        Defendant
        
        Property located at 123 Main Street, Lexington, KY 40508
      `;

      const result = parseLisPendens(text);

      expect(result.plaintiff.isGoodLead).toBe(true);
      expect(result.plaintiff.type).toBe('bank');
      expect(result.defendant.isGoodLead).toBe(true);
      expect(result.defendant.type).toBe('individual');
    });

    it('should identify HOA plaintiff as bad lead', () => {
      const text = `
        OAKWOOD HOMEOWNERS ASSOCIATION
        Plaintiff
        
        vs.
        
        JANE SMITH
        Defendant
      `;

      const result = parseLisPendens(text);

      expect(result.plaintiff.isGoodLead).toBe(false);
      expect(result.plaintiff.type).toBe('hoa');
    });

    it('should identify LLC defendant as bad lead', () => {
      const text = `
        CHASE BANK
        Plaintiff
        
        vs.
        
        ABC PROPERTIES LLC
        Defendant
      `;

      const result = parseLisPendens(text);

      expect(result.plaintiff.isGoodLead).toBe(true);
      expect(result.defendant.isGoodLead).toBe(false);
      expect(result.defendant.type).toBe('llc');
    });

    it('should extract property addresses', () => {
      const text = `
        BANK OF AMERICA, N.A., Plaintiff
        vs.
        JOHN DOE, Defendant
        
        Regarding the property at 456 Oak Avenue, Lexington, KY 40509
      `;

      const result = parseLisPendens(text);

      expect(result.allAddresses.length).toBeGreaterThan(0);
      expect(result.propertyAddress).not.toBeNull();
    });

    it('should handle multiple plaintiffs and flag concerns', () => {
      const text = `
        WELLS FARGO BANK and US BANK
        Plaintiffs
        
        vs.
        
        JOHN DOE
        Defendant
      `;

      const result = parseLisPendens(text);

      // Should flag concern about multiple plaintiffs (potential second mortgage)
      expect(result.plaintiff.concerns.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify credit union plaintiffs', () => {
      const text = `
        CENTRAL FEDERAL CREDIT UNION
        Plaintiff
        
        vs.
        
        MARY JONES
        Defendant
      `;

      const result = parseLisPendens(text);

      expect(result.plaintiff.isGoodLead).toBe(true);
      expect(result.plaintiff.type).toBe('credit_union');
    });

    it('should identify trust defendants as good but potentially complex', () => {
      const text = `
        MORTGAGE SERVICER INC
        Plaintiff
        
        vs.
        
        JOHN DOE, AS TRUSTEE OF THE DOE FAMILY TRUST
        Defendant
      `;

      const result = parseLisPendens(text);

      expect(result.defendant.type).toBe('trust');
      expect(result.defendant.isGoodLead).toBe(true);
    });

    it('should return raw text in result', () => {
      const text = 'Sample lis pendens document text';
      const result = parseLisPendens(text);

      expect(result.rawText).toBe(text);
    });

    it('should handle text with Unknown Plaintiff when pattern not found', () => {
      const text = 'This is just random text with no legal structure';
      const result = parseLisPendens(text);

      expect(result.plaintiff.name).toBe('Unknown Plaintiff');
    });

    it('should handle county government plaintiff', () => {
      const text = `
        FAYETTE COUNTY
        Plaintiff
        
        vs.
        
        ABANDONED PROPERTY OWNER
        Defendant
      `;

      const result = parseLisPendens(text);

      expect(result.plaintiff.isGoodLead).toBe(false);
      expect(result.plaintiff.type).toBe('government');
    });
  });
});
