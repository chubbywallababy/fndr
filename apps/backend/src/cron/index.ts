// apps/backend/src/cron/run-email-scan.ts
import { processFayette } from '../states/kentucky/fayette';
import { publishToSlack } from '../notifications/slack';
import { formatAddressesMarkdown } from '../notifications/markdown';

function getDateRange() {
  const lookbackDays = Number(process.env.LOOKBACK_DAYS ?? 10);

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

  const markdown = formatAddressesMarkdown(results.flatMap((result) => result.addresses));
  await publishToSlack({
    text: markdown,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
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
