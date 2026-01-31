// apps/backend/src/cron/run-email-scan.ts
import 'dotenv/config';
import { processFayette } from '../states/kentucky/fayette';
import { publishLeadReport, publishToSlack } from '../notifications/slack';
import { ClassifiedLead } from '../classifiers/lead-classifier';

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

  // Extract classified leads from results
  const leads: ClassifiedLead[] = results.map(r => r.lead);

  // Group and log summary
  const grouped = {
    good: leads.filter(l => l.classification.overallScore === 'good'),
    review: leads.filter(l => l.classification.overallScore === 'review'),
    bad: leads.filter(l => l.classification.overallScore === 'bad'),
  };

  console.log(`[cron] Classification summary:`);
  console.log(`[cron]   Good leads: ${grouped.good.length}`);
  console.log(`[cron]   Needs review: ${grouped.review.length}`);
  console.log(`[cron]   Filtered out: ${grouped.bad.length}`);

  // Publish to Slack using the new lead report format
  await publishLeadReport(leads);
  
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
