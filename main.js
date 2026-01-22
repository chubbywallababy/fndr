const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const {URL} = require("url");

// URL for the search POST request
const URL_SEARCH = "https://fayettedeeds.com/landrecords/index.php";

// === RAW form data, exactly like cURL with proper URL encoding ===
const rawFormData = `
searchType=davidson&show_pick_list=off&party_type=&search_type=Both&grantor_last_name=&grantor_first_name=&grantor_middle_initial=&grantee_last_name=&grantee_first_name=&grantee_middle_initial=&both_last_name=&both_first_name=&both_middle_initial=&StreetNum=&directional=&streetName=&type=&SubName=&lot=&block=&inst_num=&booknum=&pagenum=&suffix=&description=&start_date=01/13/2026&end_date=01/30/2026&startamt=&endamt=&InstGroupSelect=DocType&instType%5BALL%5D=ALL&instType%5BARTICLES%5D=ARTICLES&instType%5B%24k%5D%5BART%5D=ART&instType%5BDEEDS%5D=DEEDS&instType%5B%24k%5D%5BDEED%5D=DEED&instType%5BDELINQUENT%20TAX%5D=DELINQUENT+TAX&instType%5B%24k%5D%5BDT%5D=DT&instType%5BFIXTURE%20FILING%5D=FIXTURE+FILING&instType%5B%24k%5D%5BFIX%5D=FIX&instType%5BLAND%20RECORDS%5D=LAND+RECORDS&instType%5B%24k%5D%5BLR%5D=LR&instType%5BLEASES%5D=LEASES&instType%5B%24k%5D%5BLEASE%5D=LEASE&instType%5BLIENS%5D=LIENS&instType%5B%24k%5D%5BLIEN%5D=LIEN&instType%5BMISCELLANEOUS%5D=MISCELLANEOUS&instType%5B%24k%5D%5BMISC%5D=MISC&instType%5BMORTGAGES%5D=MORTGAGES&instType%5B%24k%5D%5BMTG%5D=MTG&instType%5BPLAT%5D=PLAT&instType%5BPOWER%20OF%20ATTORNEY%5D=POWER+OF+ATTORNEY&instType%5B%24k%5D%5BPOA%5D=POA&instType%5BRELEASE%5D=RELEASE&instType%5B%24k%5D%5BREL%5D=REL&instType%5BWILLS%5D=WILLS&instType%5B%24k%5D%5BWILL%5D=WILL&instDocType%5B%24k%5D%5B032%5D=032
`.trim();

// === Session cookie from your working cURL ===
const COOKIE = "PHPSESSID=8vn4atpgf78nf9fucngloojrhn";

const pdfParse = require("pdf-parse");

// Function to extract addresses from a PDF file
async function extractAddressesFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    // Simple regex for US-style addresses (street number + street name)
    const addressRegex = /\d{1,6}\s+[A-Za-z0-9.\- ]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Terrace|Pl|Place|Circle|Cir)\b/g;

    const matches = text.match(addressRegex);
    if (matches && matches.length > 0) {
      console.log(`Addresses found in ${filePath}:`);
      matches.forEach(addr => console.log(" -", addr));
    } else {
      console.log(`No addresses found in ${filePath}.`);
    }
  } catch (err) {
    console.error(`Failed to parse PDF ${filePath}:`, err.message);
  }
}

// === Main function ===
async function main() {
  try {
    // Step 1: Send search POST request
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

      // PDF link in the table
      const pdfLink = $(row).find('a[href*="type=pdf"]').attr("href");
      if (!pdfLink) {
        console.log(`No PDF found for ${id}`);
        continue;
      }

      // Construct full URL if relative
      const pdfUrl = pdfLink.startsWith("http")
        ? pdfLink
        : new URL(pdfLink, "https://fayettedeeds.com/landrecords/").href;

      // Print debug info for every request
      console.log("\n=== PDF Request ===");
      console.log("ID:", id);
      console.log("URL:", pdfUrl);
      console.log("Headers:", {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://fayettedeeds.com/landrecords/index.php",
        Cookie: COOKIE,
      });

      // Step 2: Download PDF
      try {
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
        console.log(`Saved PDF as ${id}.pdf`);
      } catch (err) {
        console.error(`Failed to download PDF for ${id}:`, err.response?.status, err.response?.statusText);
      }
    }

    console.log("\nAll attempts finished.");
  } catch (err) {
    console.error("Search request failed:", err.response?.status, err.response?.statusText, err.message);
  }

  try {
    // Directory where PDFs were saved
    const pdfDir = __dirname;

    // Read all PDF files in the directory
    const pdfFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith(".pdf"));

    // Loop through each PDF and extract addresses
    for (const file of pdfFiles) {
      const filePath = path.join(pdfDir, file);
      await extractAddressesFromPDF(filePath);
    }
  } catch (err) {
    console.log(err)
  }
}

main();
