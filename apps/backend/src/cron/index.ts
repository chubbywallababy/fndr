// apps/backend/src/cron/run-email-scan.ts
import 'dotenv/config';
import { processFayette } from '../states/kentucky/fayette';
import { publishToSlack } from '../notifications/slack';

/**
 * Parses command line arguments
 */
function parseArgs(): { savePdfs: boolean; pdfOutputDir?: string } {
  const args = process.argv.slice(2);
  
  const savePdfs = args.includes('--save-pdfs');
  
  // Check for --pdf-output-dir=<path> argument
  const outputDirArg = args.find(arg => arg.startsWith('--pdf-output-dir='));
  const pdfOutputDir = outputDirArg ? outputDirArg.split('=')[1] : undefined;
  
  return { savePdfs, pdfOutputDir };
}

function getDateRange() {
  const lookbackDays = Number(process.env.LOOKBACK_DAYS ?? 3);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - lookbackDays);

  return { start, end };
}

async function main() {
  const { savePdfs, pdfOutputDir } = parseArgs();
  
  console.log('[cron] Scan job started');
  console.log(`[cron] Save PDFs: ${savePdfs}${pdfOutputDir ? ` (output dir: ${pdfOutputDir})` : ''}`);

  const { start, end } = getDateRange();

  console.log(
    `[cron] Scanning emails from ${start.toISOString()} → ${end.toISOString()}`
  );

  const results = await processFayette({ 
    startDate: start.toISOString(), 
    endDate: end.toISOString(),
    savePdfs,
    pdfOutputDir,
  });

  console.log(`[cron] Scan complete. Found ${results.length} items`);

  const allAddresses = results.flatMap((result) => result.addresses);

  // Group by quality
  const grouped = {
    high: allAddresses.filter(a => a.quality === "high"),
    medium: allAddresses.filter(a => a.quality === "medium"),
    low: allAddresses.filter(a => a.quality === "low"),
  };
  
  // Build markdown with section headers
  const markdown = `
  *High quality addresses (${grouped.high.length})*
  ${grouped.high.map(a => `• ${a.cleaned}`).join("\n")}
  
  *Medium quality addresses (${grouped.medium.length})*
  ${grouped.medium.map(a => `• ${a.cleaned}`).join("\n")}
  
  *Low quality / needs review (${grouped.low.length})*
  ${grouped.low.map(a => `• ${a.cleaned}`).join("\n")}
  `.trim();

  await publishToSlack({
    text: markdown,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: markdown,
        },
      },
    ],
  });
  
  console.log(`[cron] Notification sent to Slack`);

}

main()
  .then(() => {
    console.log('[cron] Job finished successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[cron] Job failed', err);
    process.exit(1);
  });
