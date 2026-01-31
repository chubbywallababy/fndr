import axios from 'axios';
import * as cheerio from 'cheerio';
import { FayetteInputs } from '../../../types';
import { readPdfFromUrl, PdfReaderOptions } from '../../../document/pdf-reader';
import { parseLisPendens, LisPendensParseResult } from '../../../parsers/lis-pendens-parser';
import { extractAddressesFromText, filterIgnoredAddresses, ParsedAddress } from '../../../parsers/address-parser';
import { createClassifiedLead, ClassifiedLead } from '../../../classifiers/lead-classifier';

export interface FayetteResult {
  id: string;
  pdfUrl?: string;
  lead: ClassifiedLead;
  // Legacy field for backward compatibility
  addresses: ParsedAddress[];
}

const URL_SEARCH = 'https://fayettedeeds.com/landrecords/index.php';
const DEFAULT_COOKIE = 'PHPSESSID=8vn4atpgf78nf9fucngloojrhn';

// Base form data template (dates will be replaced)
const BASE_FORM_DATA = `searchType=davidson&show_pick_list=off&party_type=&search_type=Both&grantor_last_name=&grantor_first_name=&grantor_middle_initial=&grantee_last_name=&grantee_first_name=&grantee_middle_initial=&both_last_name=&both_first_name=&both_middle_initial=&StreetNum=&directional=&streetName=&type=&SubName=&lot=&block=&inst_num=&booknum=&pagenum=&suffix=&description=&start_date={START_DATE}&end_date={END_DATE}&startamt=&endamt=&InstGroupSelect=DocType&instType%5BALL%5D=ALL&instType%5BARTICLES%5D=ARTICLES&instType%5B%24k%5D%5BART%5D=ART&instType%5BDEEDS%5D=DEEDS&instType%5B%24k%5D%5BDEED%5D=DEED&instType%5BDELINQUENT%20TAX%5D=DELINQUENT+TAX&instType%5B%24k%5D%5BDT%5D=DT&instType%5BFIXTURE%20FILING%5D=FIXTURE+FILING&instType%5B%24k%5D%5BFIX%5D=FIX&instType%5BLAND%20RECORDS%5D=LAND+RECORDS&instType%5B%24k%5D%5BLR%5D=LR&instType%5BLEASES%5D=LEASES&instType%5B%24k%5D%5BLEASE%5D=LEASE&instType%5BLIENS%5D=LIENS&instType%5B%24k%5D%5BLIEN%5D=LIEN&instType%5BMISCELLANEOUS%5D=MISCELLANEOUS&instType%5B%24k%5D%5BMISC%5D=MISC&instType%5BMORTGAGES%5D=MORTGAGES&instType%5B%24k%5D%5BMTG%5D=MTG&instType%5BPLAT%5D=PLAT&instType%5BPOWER%20OF%20ATTORNEY%5D=POWER+OF+ATTORNEY&instType%5B%24k%5D%5BPOA%5D=POA&instType%5BRELEASE%5D=RELEASE&instType%5B%24k%5D%5BREL%5D=REL&instType%5BWILLS%5D=WILLS&instType%5B%24k%5D%5BWILL%5D=WILL&instDocType%5B%24k%5D%5B032%5D=032`;

function buildFormData(inputs: FayetteInputs): string {
  return BASE_FORM_DATA
    .replace('{START_DATE}', inputs.startDate)
    .replace('{END_DATE}', inputs.endDate);
}

/**
 * Process a single PDF and return a classified lead
 */
async function processPdf(
  id: string,
  pdfUrl: string,
  cookie: string,
  options: {
    ignoreAddresses?: string[];
    savePdfs?: boolean;
    pdfOutputDir?: string;
  }
): Promise<FayetteResult> {
  // Read PDF and extract text
  const pdfOptions: PdfReaderOptions = {
    savePdfs: options.savePdfs,
    pdfOutputDir: options.pdfOutputDir,
    axiosConfig: {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://fayettedeeds.com/landrecords/index.php',
        Cookie: cookie,
      },
    },
  };

  const { text } = await readPdfFromUrl(pdfUrl, id, pdfOptions);

  // Parse the Lis Pendens document
  const parseResult: LisPendensParseResult = parseLisPendens(text);

  // Filter ignored addresses
  const filteredAddresses = filterIgnoredAddresses(
    parseResult.allAddresses,
    options.ignoreAddresses
  );

  // Create classified lead
  const lead = createClassifiedLead(id, pdfUrl, {
    ...parseResult,
    allAddresses: filteredAddresses,
  });

  return {
    id,
    pdfUrl,
    lead,
    addresses: filteredAddresses,
  };
}

export async function processFayette(inputs: FayetteInputs): Promise<FayetteResult[]> {
  const results: FayetteResult[] = [];
  const cookie = inputs.cookie || DEFAULT_COOKIE;
  const formData = buildFormData(inputs);

  try {
    // Step 1: Send search POST request
    const searchResp = await axios.post(URL_SEARCH, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://fayettedeeds.com',
        Referer: 'https://fayettedeeds.com/landrecords/index.php',
        'User-Agent': 'Mozilla/5.0',
        Cookie: cookie,
      },
    });

    const $ = cheerio.load(searchResp.data);
    const rows = $('#results tbody tr');

    console.log(`[fayette] Found ${rows.length} rows in the table.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = $(row).attr('id');
      if (!id) continue;

      const pdfLink = $(row).find('a[href*="type=pdf"]').attr('href');
      if (!pdfLink) {
        console.log(`[fayette] No PDF found for ${id}`);
        continue;
      }

      const pdfUrl = pdfLink.startsWith('http')
        ? pdfLink
        : new URL(pdfLink, 'https://fayettedeeds.com/landrecords/').href;

      try {
        const result = await processPdf(id, pdfUrl, cookie, {
          ignoreAddresses: inputs.ignoreAddresses,
          savePdfs: inputs.savePdfs,
          pdfOutputDir: inputs.pdfOutputDir,
        });

        results.push(result);

        // Log classification result
        const { lead } = result;
        console.log(`[fayette] ${id}: ${lead.classification.overallScore.toUpperCase()} - ` +
          `Plaintiff: ${lead.plaintiff.name} (${lead.plaintiff.type}), ` +
          `Defendant: ${lead.defendant.name} (${lead.defendant.type})`);

        if (lead.classification.stopReason) {
          console.log(`[fayette] ${id}: STOPPED - ${lead.classification.stopReason}`);
        }
      } catch (err: any) {
        console.error(`[fayette] Failed to parse PDF for ${id}:`, err.response?.status, err.response?.statusText, err.message);
      }
    }

    return results;
  } catch (err: any) {
    console.error('[fayette] Search request failed:', err.response?.status, err.response?.statusText, err.message);
    throw err;
  }
}
