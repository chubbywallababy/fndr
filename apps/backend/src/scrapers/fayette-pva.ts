/**
 * Fayette County PVA (Property Valuation Administrator) Scraper
 * 
 * Scrapes property data from the Fayette County PVA website.
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface PvaPropertyData {
  // Sale history
  lastSaleDate: Date | null;
  lastSalePrice: number | null;
  yearsOwned: number | null;
  
  // Assessed values
  assessedValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  
  // Property characteristics
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  
  // Owner info from PVA
  ownerName: string | null;
  ownerAddress: string | null;
  
  // Calculated
  estimatedEquity: number | null;
  
  // Meta
  pvaUrl: string | null;
  scrapedAt: Date;
}

export interface ScraperOptions {
  headless?: boolean;
  debug?: boolean;
  timeout?: number;
}

const PVA_BASE_URL = 'https://qpublic.schneidercorp.com/Application.aspx?AppID=628&LayerID=8284&PageTypeID=2&KeyValue=';
const PVA_SEARCH_URL = 'https://qpublic.schneidercorp.com/Application.aspx?AppID=628&LayerID=8284&PageTypeID=4';

let browser: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(options: ScraperOptions): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: options.headless ?? true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Parse currency string to number
 */
function parseCurrency(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse date string to Date object
 */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Calculate years owned from sale date
 */
function calculateYearsOwned(saleDate: Date | null): number | null {
  if (!saleDate) return null;
  const now = new Date();
  const years = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(years * 10) / 10; // Round to 1 decimal
}

/**
 * Estimate equity based on assessed value and typical loan amounts
 */
function estimateEquity(assessedValue: number | null, lastSalePrice: number | null, yearsOwned: number | null): number | null {
  if (!assessedValue) return null;
  
  // If we have sale info, estimate based on typical appreciation and paydown
  if (lastSalePrice && yearsOwned) {
    // Assume 3% annual appreciation
    const currentValue = lastSalePrice * Math.pow(1.03, yearsOwned);
    // Assume 80% LTV at purchase, ~2% principal paydown per year
    const remainingLoan = lastSalePrice * 0.8 * Math.max(0, 1 - (yearsOwned * 0.02));
    return Math.round(currentValue - remainingLoan);
  }
  
  // Fallback: assume 30% equity on assessed value
  return Math.round(assessedValue * 0.3);
}

/**
 * Extract property data from PVA page
 */
async function extractPropertyData(page: Page, url: string): Promise<PvaPropertyData | null> {
  try {
    const data: PvaPropertyData = {
      lastSaleDate: null,
      lastSalePrice: null,
      yearsOwned: null,
      assessedValue: null,
      landValue: null,
      improvementValue: null,
      bedrooms: null,
      bathrooms: null,
      squareFeet: null,
      yearBuilt: null,
      propertyType: null,
      ownerName: null,
      ownerAddress: null,
      estimatedEquity: null,
      pvaUrl: url,
      scrapedAt: new Date(),
    };

    // Extract owner name
    const ownerEl = await page.$('td:contains("Owner Name") + td, span[id*="Owner"]');
    if (ownerEl) {
      data.ownerName = await page.evaluate(el => el.textContent?.trim() || null, ownerEl);
    }

    // Extract owner address
    const ownerAddrEl = await page.$('td:contains("Mailing Address") + td');
    if (ownerAddrEl) {
      data.ownerAddress = await page.evaluate(el => el.textContent?.trim() || null, ownerAddrEl);
    }

    // Extract assessed value
    const assessedEl = await page.$('td:contains("Total Appraisal") + td, td:contains("Assessed Value") + td');
    if (assessedEl) {
      const assessedText = await page.evaluate(el => el.textContent, assessedEl);
      data.assessedValue = parseCurrency(assessedText);
    }

    // Extract land value
    const landEl = await page.$('td:contains("Land Value") + td, td:contains("Land Appraisal") + td');
    if (landEl) {
      const landText = await page.evaluate(el => el.textContent, landEl);
      data.landValue = parseCurrency(landText);
    }

    // Extract improvement value
    const improvementEl = await page.$('td:contains("Improvement Value") + td, td:contains("Improvements") + td');
    if (improvementEl) {
      const improvementText = await page.evaluate(el => el.textContent, improvementEl);
      data.improvementValue = parseCurrency(improvementText);
    }

    // Extract sale date
    const saleDateEl = await page.$('td:contains("Sale Date") + td');
    if (saleDateEl) {
      const saleDateText = await page.evaluate(el => el.textContent, saleDateEl);
      data.lastSaleDate = parseDate(saleDateText);
    }

    // Extract sale price
    const salePriceEl = await page.$('td:contains("Sale Price") + td');
    if (salePriceEl) {
      const salePriceText = await page.evaluate(el => el.textContent, salePriceEl);
      data.lastSalePrice = parseCurrency(salePriceText);
    }

    // Extract year built
    const yearBuiltEl = await page.$('td:contains("Year Built") + td');
    if (yearBuiltEl) {
      const yearBuiltText = await page.evaluate(el => el.textContent, yearBuiltEl);
      data.yearBuilt = yearBuiltText ? parseInt(yearBuiltText, 10) : null;
    }

    // Extract square feet
    const sqftEl = await page.$('td:contains("Total Sq Ft") + td, td:contains("Living Area") + td');
    if (sqftEl) {
      const sqftText = await page.evaluate(el => el.textContent, sqftEl);
      data.squareFeet = sqftText ? parseInt(sqftText.replace(/,/g, ''), 10) : null;
    }

    // Extract bedrooms
    const bedroomsEl = await page.$('td:contains("Bedrooms") + td');
    if (bedroomsEl) {
      const bedroomsText = await page.evaluate(el => el.textContent, bedroomsEl);
      data.bedrooms = bedroomsText ? parseInt(bedroomsText, 10) : null;
    }

    // Extract bathrooms
    const bathroomsEl = await page.$('td:contains("Bathrooms") + td, td:contains("Full Baths") + td');
    if (bathroomsEl) {
      const bathroomsText = await page.evaluate(el => el.textContent, bathroomsEl);
      data.bathrooms = bathroomsText ? parseFloat(bathroomsText) : null;
    }

    // Extract property type
    const propTypeEl = await page.$('td:contains("Property Type") + td, td:contains("Land Use") + td');
    if (propTypeEl) {
      data.propertyType = await page.evaluate(el => el.textContent?.trim() || null, propTypeEl);
    }

    // Calculate derived fields
    data.yearsOwned = calculateYearsOwned(data.lastSaleDate);
    data.estimatedEquity = estimateEquity(data.assessedValue, data.lastSalePrice, data.yearsOwned);

    return data;
  } catch (error) {
    console.error('[fayette-pva] Error extracting property data:', error);
    return null;
  }
}

/**
 * Scrape PVA data by property address
 */
export async function scrapePvaByAddress(
  address: string,
  options: ScraperOptions = {}
): Promise<PvaPropertyData | null> {
  const debug = options.debug ?? false;
  let page: Page | null = null;

  try {
    const browserInstance = await getBrowser(options);
    page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    if (debug) {
      console.log(`[fayette-pva] Searching by address: ${address}`);
    }

    // Navigate to search page
    await page.goto(PVA_SEARCH_URL, { waitUntil: 'networkidle0', timeout: options.timeout ?? 30000 });

    // Look for address search input
    const addressInput = await page.$('input[name*="Address"], input[id*="Address"], input[placeholder*="Address"]');
    if (!addressInput) {
      if (debug) console.log('[fayette-pva] Could not find address search input');
      return null;
    }

    // Enter address and search
    await addressInput.type(address);
    
    // Click search button
    const searchButton = await page.$('input[type="submit"], button[type="submit"]');
    if (searchButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: options.timeout ?? 30000 }),
        searchButton.click(),
      ]);
    }

    // Check if we landed on a property page or search results
    const currentUrl = page.url();
    
    // If on search results, click first result
    const firstResult = await page.$('a[href*="KeyValue"], table.SearchResults a');
    if (firstResult) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: options.timeout ?? 30000 }),
        firstResult.click(),
      ]);
    }

    return await extractPropertyData(page, page.url());
  } catch (error: any) {
    if (debug) {
      console.error(`[fayette-pva] Error scraping by address: ${error.message}`);
    }
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Scrape PVA data by owner name
 */
export async function scrapePvaByOwner(
  ownerName: string,
  options: ScraperOptions = {}
): Promise<PvaPropertyData | null> {
  const debug = options.debug ?? false;
  let page: Page | null = null;

  try {
    const browserInstance = await getBrowser(options);
    page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    if (debug) {
      console.log(`[fayette-pva] Searching by owner: ${ownerName}`);
    }

    // Navigate to search page
    await page.goto(PVA_SEARCH_URL, { waitUntil: 'networkidle0', timeout: options.timeout ?? 30000 });

    // Look for owner name search input
    const ownerInput = await page.$('input[name*="Owner"], input[id*="Owner"], input[placeholder*="Owner"]');
    if (!ownerInput) {
      if (debug) console.log('[fayette-pva] Could not find owner search input');
      return null;
    }

    // Enter owner name and search
    await ownerInput.type(ownerName);
    
    // Click search button
    const searchButton = await page.$('input[type="submit"], button[type="submit"]');
    if (searchButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: options.timeout ?? 30000 }),
        searchButton.click(),
      ]);
    }

    // Check if we got results
    const firstResult = await page.$('a[href*="KeyValue"], table.SearchResults a');
    if (firstResult) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: options.timeout ?? 30000 }),
        firstResult.click(),
      ]);
    }

    return await extractPropertyData(page, page.url());
  } catch (error: any) {
    if (debug) {
      console.error(`[fayette-pva] Error scraping by owner: ${error.message}`);
    }
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
}
