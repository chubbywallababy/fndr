// apps/backend/src/cron/run-email-scan.ts
import { processFayette } from '../states/kentucky/fayette';
import { publishToSlack } from '../notifications/slack';

function getDateRange() {
  const lookbackDays = Number(process.env.LOOKBACK_DAYS ?? 3);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - lookbackDays);

  return { start, end };
}

async function main() {
  console.log('[cron] Scan job started');

  const { start, end } = getDateRange();

  console.log(
    `[cron] Scanning emails from ${start.toISOString()} → ${end.toISOString()}`
  );

  const results = await processFayette({ startDate: start.toISOString(), endDate: end.toISOString() });

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
