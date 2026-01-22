const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const {URL} = require("url");
const pdfParse = require("pdf-parse");

// Optional OCR
const Tesseract = require("tesseract.js"); // only used if --ocr flag is set

// === Config ===
const URL_SEARCH = "https://fayettedeeds.com/landrecords/index.php";
const COOKIE = "PHPSESSID=8vn4atpgf78nf9fucngloojrhn";

// Raw cURL-encoded form data (exact match)
const rawFormData = `
searchType=davidson&show_pick_list=off&party_type=&search_type=Both&grantor_last_name=&grantor_first_name=&grantor_middle_initial=&grantee_last_name=&grantee_first_name=&grantee_middle_initial=&both_last_name=&both_first_name=&both_middle_initial=&StreetNum=&directional=&streetName=&type=&SubName=&lot=&block=&inst_num=&booknum=&pagenum=&suffix=&description=&start_date=01/13/2026&end_date=01/30/2026&startamt=&endamt=&InstGroupSelect=DocType&instType%5BALL%5D=ALL&instType%5BARTICLES%5D=ARTICLES&instType%5B%24k%5D%5BART%5D=ART&instType%5BDEEDS%5D=DEEDS&instType%5B%24k%5D%5BDEED%5D=DEED&instType%5BDELINQUENT%20TAX%5D=DELINQUENT+TAX&instType%5B%24k%5D%5BDT%5D=DT&instType%5BFIXTURE%20FILING%5D=FIXTURE+FILING&instType%5B%24k%5D%5BFIX%5D=FIX&instType%5BLAND%20RECORDS%5D=LAND+RECORDS&instType%5B%24k%5D%5BLR%5D=LR&instType%5BLEASES%5D=LEASES&instType%5B%24k%5D%5BLEASE%5D=LEASE&instType%5BLIENS%5D=LIENS&instType%5B%24k%5D%5BLIEN%5D=LIEN&instType%5BMISCELLANEOUS%5D=MISCELLANEOUS&instType%5B%24k%5D%5BMISC%5D=MISC&instType%5BMORTGAGES%5D=MORTGAGES&instType%5B%24k%5D%5BMTG%5D=MTG&instType%5BPLAT%5D=PLAT&instType%5BPOWER%20OF%20ATTORNEY%5D=POWER+OF+ATTORNEY&instType%5B%24k%5D%5BPOA%5D=POA&instType%5BRELEASE%5D=RELEASE&instType%5B%24k%5D%5BREL%5D=REL&instType%5BWILLS%5D=WILLS&instType%5B%24k%5D%5BWILL%5D=WILL&instDocType%5B%24k%5D%5B032%5D=032
`.trim();

// Regex to detect US-style addresses
const ADDRESS_REGEX = /\b\d{1,6}\s+[A-Za-z0-9.\s]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Pl|Place|Way|Cir|Circle)\b.*?(?:\d{5})?/gi;

// === Helper: Extract text from PDF ===
async function extractTextFromPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  if (!data.text.trim()) return null;
  return data.text;
}

// === OCR fallback ===
async function extractTextWithOcr(filePath) {
  console.log("Running OCR on", filePath);
  const {data: {text}} = await Tesseract.recognize(filePath, "eng");
  return text;
}

// === Extract addresses from text ===
function extractAddresses(text) {
  const matches = text.match(ADDRESS_REGEX) || [];
  return [...new Set(matches.map(a => a.trim()))]; // dedupe
}

// === Main pipeline ===
async function main() {
  const useOcr = process.argv.includes("--ocr");
  const results = []; // {id, address}

  try {
    // Step 1: Search
    const searchResp = await axios.post(URL_SEARCH, rawFormData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://fayettedeeds.com",
        Referer: "https://fayettedeeds.com/landrecords/index.php",
        "User-Agent": "Mozilla/5.0",
        Cookie: COOKIE,
      },
    });

    const $ = cheerio.load(searchResp.data);
    const rows = $("#results tbody tr");
    console.log(`Found ${rows.length} rows in the table.`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const id = $(row).attr("id");
      if (!id) continue;

      const pdfLink = $(row).find('a[href*="type=pdf"]').attr("href");
      if (!pdfLink) continue;

      // Remove fragment (#toolbar=0)
      const pdfUrl = pdfLink.split("#")[0];
      console.log("\n=== Downloading PDF ===", id, pdfUrl);

      // Download PDF
      const pdfResp = await axios.get(pdfUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://fayettedeeds.com/landrecords/index.php",
          Cookie: COOKIE,
        },
      });

      const filePath = path.join(__dirname, `${id}.pdf`);
      fs.writeFileSync(filePath, pdfResp.data);
      console.log("Saved PDF:", filePath);

      // Extract text
      let text = await extractTextFromPdf(filePath);

      // Optional OCR fallback
      if (!text && useOcr) text = await extractTextWithOcr(filePath);

      if (!text) {
        console.warn("No text extracted from PDF", id);
        continue;
      }

      // Extract addresses
      const addresses = extractAddresses(text);
      console.log("Addresses found:", addresses);

      // Save results
      addresses.forEach(addr => results.push({id, address: addr}));
    }

    // Save CSV
    const csvLines = ["document_id,address", ...results.map(r => `${r.id},"${r.address}"`)];
    fs.writeFileSync(path.join(__dirname, "addresses.csv"), csvLines.join("\n"));
    console.log("All addresses saved to addresses.csv");

  } catch (err) {
    console.error("Error in pipeline:", err.message);
  }
}

main();
