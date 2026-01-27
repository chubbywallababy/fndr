// apps/backend/src/cron/slack.ts

type SlackMessageOptions = {
  title?: string;
  text: string;
  blocks?: any[];
};

export async function publishToSlack({
  title,
  text,
  blocks,
}: SlackMessageOptions): Promise<void> {
  const webhookUrl = process.env.FNDR_SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL is not set');
  }

  const payload: Record<string, any> = {
    text, // fallback text (important)
  };

  if (title || blocks) {
    payload.blocks =
      blocks ??
      [
        ...(title
          ? [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: title,
                },
              },
            ]
          : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text,
          },
        },
      ];
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText} - ${body}`
    );
  }
}
