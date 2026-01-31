// apps/backend/src/notifications/slack.ts

import { ClassifiedLead, OverallScore } from '../classifiers/lead-classifier';

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
    throw new Error('FNDR_SLACK_WEBHOOK_URL is not set');
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

/* ============================================================
   Lead Formatting Functions
   ============================================================ */

/**
 * Formats a single lead for Slack display
 */
function formatLeadForSlack(lead: ClassifiedLead): string {
  const lines: string[] = [];
  
  // Address line
  const address = lead.propertyAddress?.cleaned || 'Address not found';
  lines.push(`• *${address}*`);
  
  // Plaintiff and Defendant info
  const plaintiffType = lead.plaintiff.type !== 'unknown' 
    ? ` (${lead.plaintiff.type})` 
    : '';
  const defendantType = lead.defendant.type !== 'unknown' 
    ? ` (${lead.defendant.type})` 
    : '';
  
  lines.push(`  Plaintiff: ${lead.plaintiff.name}${plaintiffType}`);
  lines.push(`  Defendant: ${lead.defendant.name}${defendantType}`);
  
  // Mailing address if different
  if (lead.mailingAddress && 
      lead.mailingAddress.cleaned !== lead.propertyAddress?.cleaned) {
    lines.push(`  Mailing: ${lead.mailingAddress.cleaned}`);
  }
  
  // Concerns/warnings
  if (lead.classification.concerns.length > 0) {
    lead.classification.concerns.forEach(concern => {
      lines.push(`  :warning: ${concern}`);
    });
  }
  
  // Lookup links
  const links = [
    `<${lead.lookupLinks.zillow}|Zillow>`,
    `<${lead.lookupLinks.googleMaps}|Maps>`,
    `<${lead.lookupLinks.pva}|PVA>`,
  ];
  lines.push(`  ${links.join(' | ')}`);
  
  return lines.join('\n');
}

/**
 * Formats a filtered/bad lead for Slack display (shorter format)
 */
function formatFilteredLeadForSlack(lead: ClassifiedLead): string {
  const reason = lead.classification.stopReason || 'Unknown reason';
  const name = lead.defendant.name || lead.plaintiff.name || lead.id;
  return `• ${reason}: ${name}`;
}

/**
 * Groups leads by their overall score
 */
export function groupLeadsByScore(leads: ClassifiedLead[]): {
  good: ClassifiedLead[];
  review: ClassifiedLead[];
  bad: ClassifiedLead[];
} {
  return {
    good: leads.filter(l => l.classification.overallScore === 'good'),
    review: leads.filter(l => l.classification.overallScore === 'review'),
    bad: leads.filter(l => l.classification.overallScore === 'bad'),
  };
}

/**
 * Formats all leads into Slack blocks
 */
export function formatLeadsForSlack(leads: ClassifiedLead[]): {
  text: string;
  blocks: any[];
} {
  const grouped = groupLeadsByScore(leads);
  const blocks: any[] = [];
  
  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `Lis Pendens Report - ${new Date().toLocaleDateString()}`,
      emoji: true,
    },
  });
  
  // Summary section
  const summaryText = `Found *${leads.length}* leads: ` +
    `:white_check_mark: ${grouped.good.length} good | ` +
    `:eyes: ${grouped.review.length} need review | ` +
    `:x: ${grouped.bad.length} filtered out`;
  
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: summaryText,
    },
  });
  
  blocks.push({ type: 'divider' });
  
  // Good leads section
  if (grouped.good.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *Good Leads (${grouped.good.length})*`,
      },
    });
    
    const goodLeadsText = grouped.good
      .map(formatLeadForSlack)
      .join('\n\n');
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: goodLeadsText,
      },
    });
    
    blocks.push({ type: 'divider' });
  }
  
  // Needs review section
  if (grouped.review.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:eyes: *Needs Review (${grouped.review.length})*`,
      },
    });
    
    const reviewLeadsText = grouped.review
      .map(formatLeadForSlack)
      .join('\n\n');
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: reviewLeadsText,
      },
    });
    
    blocks.push({ type: 'divider' });
  }
  
  // Filtered out section (collapsed format)
  if (grouped.bad.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:x: *Filtered Out (${grouped.bad.length})*`,
      },
    });
    
    const filteredText = grouped.bad
      .map(formatFilteredLeadForSlack)
      .join('\n');
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: filteredText,
      },
    });
  }
  
  // Build fallback text
  const fallbackText = `Lis Pendens Report: ${grouped.good.length} good, ` +
    `${grouped.review.length} review, ${grouped.bad.length} filtered`;
  
  return { text: fallbackText, blocks };
}

/**
 * Publishes a lead report to Slack
 */
export async function publishLeadReport(leads: ClassifiedLead[]): Promise<void> {
  if (leads.length === 0) {
    await publishToSlack({
      title: 'Lis Pendens Report',
      text: 'No new leads found in the search range.',
    });
    return;
  }
  
  const { text, blocks } = formatLeadsForSlack(leads);
  await publishToSlack({ text, blocks });
}
