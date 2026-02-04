// apps/backend/src/notifications/slack.ts

import { ClassifiedLead, OverallScore } from '../classifiers/lead-classifier';

// Slack Block Kit limits
const SLACK_LIMITS = {
  HEADER_TEXT: 150,
  SECTION_TEXT: 3000,
  BLOCKS_PER_MESSAGE: 50,
} as const;

type SlackMessageOptions = {
  title?: string;
  text: string;
  blocks?: any[];
};

/**
 * Sanitizes text for Slack by removing/replacing problematic characters
 * that can cause invalid_blocks errors
 */
export function sanitizeSlackText(text: string): string {
  return text
    // Remove null bytes and other control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Replace degree symbols and other problematic unicode
    .replace(/[°º]/g, ' ')
    // Normalize multiple spaces to single space
    .replace(/  +/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove empty lines at start/end
    .trim();
}

/**
 * Truncates text to fit within Slack's character limit, adding ellipsis if needed
 */
export function truncateSlackText(text: string, maxLength: number): string {
  const sanitized = sanitizeSlackText(text);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  // Leave room for ellipsis
  return sanitized.slice(0, maxLength - 3) + '...';
}

/**
 * Creates a valid Slack section block with text truncation
 */
export function createSectionBlock(text: string): { type: string; text: { type: string; text: string } } {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: truncateSlackText(text, SLACK_LIMITS.SECTION_TEXT),
    },
  };
}

/**
 * Creates a valid Slack header block with text truncation
 */
export function createHeaderBlock(text: string, emoji = true): { type: string; text: { type: string; text: string; emoji: boolean } } {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: truncateSlackText(text, SLACK_LIMITS.HEADER_TEXT),
      emoji,
    },
  };
}

/**
 * Splits long text into multiple section blocks if needed
 */
export function splitIntoSectionBlocks(text: string): { type: string; text: { type: string; text: string } }[] {
  const sanitized = sanitizeSlackText(text);
  
  if (sanitized.length <= SLACK_LIMITS.SECTION_TEXT) {
    return [createSectionBlock(sanitized)];
  }
  
  const blocks: { type: string; text: { type: string; text: string } }[] = [];
  const lines = sanitized.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    // Check if adding this line would exceed the limit
    const potentialChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    
    if (potentialChunk.length > SLACK_LIMITS.SECTION_TEXT - 50) {
      // Save current chunk and start new one
      if (currentChunk) {
        blocks.push(createSectionBlock(currentChunk));
      }
      currentChunk = line;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // Add remaining chunk
  if (currentChunk) {
    blocks.push(createSectionBlock(currentChunk));
  }
  
  return blocks;
}

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
    text: truncateSlackText(text, SLACK_LIMITS.SECTION_TEXT), // fallback text (important)
  };

  if (title || blocks) {
    payload.blocks =
      blocks ??
      [
        ...(title
          ? [createHeaderBlock(title)]
          : []),
        createSectionBlock(text),
      ];
  }

  // Validate blocks limit
  if (payload.blocks && payload.blocks.length > SLACK_LIMITS.BLOCKS_PER_MESSAGE) {
    console.warn(`[slack] Truncating blocks from ${payload.blocks.length} to ${SLACK_LIMITS.BLOCKS_PER_MESSAGE}`);
    payload.blocks = payload.blocks.slice(0, SLACK_LIMITS.BLOCKS_PER_MESSAGE);
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
 * Formats currency for display
 */
function formatCurrency(amount: number | null): string {
  if (amount === null) return 'N/A';
  return '$' + amount.toLocaleString();
}

/**
 * Formats a single lead for Slack display
 */
function formatLeadForSlack(lead: ClassifiedLead): string {
  const lines: string[] = [];
  
  // Address line with quality indicator
  const address = sanitizeSlackText(lead.propertyAddress?.cleaned || 'Address not found');
  const addressQuality = lead.propertyAddress?.quality;
  const qualityIndicator = addressQuality === 'high' ? ':white_check_mark:' 
    : addressQuality === 'medium' ? ':large_yellow_circle:'
    : ':red_circle:';
  
  lines.push(`• *${address}* ${lead.propertyAddress ? qualityIndicator : ''}`);
  
  // Plaintiff and Defendant info - sanitize OCR artifacts
  const plaintiffName = sanitizeSlackText(lead.plaintiff.name);
  const defendantName = sanitizeSlackText(lead.defendant.name);
  const plaintiffType = lead.plaintiff.type !== 'unknown' 
    ? ` (${lead.plaintiff.type})` 
    : '';
  const defendantType = lead.defendant.type !== 'unknown' 
    ? ` (${lead.defendant.type})` 
    : '';
  
  lines.push(`  Plaintiff: ${plaintiffName}${plaintiffType}`);
  lines.push(`  Defendant: ${defendantName}${defendantType}`);
  
  // Mailing address if different
  if (lead.mailingAddress && 
      lead.mailingAddress.cleaned !== lead.propertyAddress?.cleaned) {
    lines.push(`  Mailing: ${lead.mailingAddress.cleaned}`);
  }
  
  // PVA Data - Equity and ownership info
  if (lead.pvaData) {
    const pva = lead.pvaData;
    const equityParts: string[] = [];
    
    // Years owned
    if (pva.yearsOwned !== null) {
      equityParts.push(`${pva.yearsOwned.toFixed(1)} years owned`);
    }
    
    // Estimated equity
    if (pva.estimatedEquity !== null) {
      const equityEmoji = pva.estimatedEquity >= 50000 ? ':moneybag:' : ':money_with_wings:';
      equityParts.push(`Est. equity: ${equityEmoji} ${formatCurrency(pva.estimatedEquity)}`);
    }
    
    if (equityParts.length > 0) {
      lines.push(`  ${equityParts.join(' | ')}`);
    }
    
    // Sale info
    if (pva.lastSaleDate || pva.lastSalePrice) {
      const saleParts: string[] = [];
      if (pva.lastSaleDate) {
        saleParts.push(`Purchased: ${pva.lastSaleDate.toLocaleDateString()}`);
      }
      if (pva.lastSalePrice) {
        saleParts.push(`for ${formatCurrency(pva.lastSalePrice)}`);
      }
      if (pva.assessedValue) {
        saleParts.push(`(Assessed: ${formatCurrency(pva.assessedValue)})`);
      }
      lines.push(`  ${saleParts.join(' ')}`);
    }
    
    // Property details
    const propertyParts: string[] = [];
    if (pva.bedrooms) propertyParts.push(`${pva.bedrooms} bed`);
    if (pva.bathrooms) propertyParts.push(`${pva.bathrooms} bath`);
    if (pva.squareFeet) propertyParts.push(`${pva.squareFeet.toLocaleString()} sqft`);
    if (pva.yearBuilt) propertyParts.push(`built ${pva.yearBuilt}`);
    
    if (propertyParts.length > 0) {
      lines.push(`  :house: ${propertyParts.join(' | ')}`);
    }
  }
  
  // Concerns/warnings
  if (lead.classification.concerns.length > 0) {
    lead.classification.concerns.forEach(concern => {
      lines.push(`  :warning: ${concern}`);
    });
  }
  
  // Always include lookup links for high and medium quality addresses
  // For low quality or missing addresses, still include but note it's based on defendant name
  if (lead.lookupLinks) {
    const hasGoodAddress = lead.propertyAddress && 
      (lead.propertyAddress.quality === 'high' || lead.propertyAddress.quality === 'medium');
    
    // Property lookup links
    const propertyLinks = [
      `<${lead.lookupLinks.zillow}|Zillow>`,
      `<${lead.lookupLinks.googleMaps}|Maps>`,
      `<${lead.lookupLinks.pva}|PVA>`,
    ];
    lines.push(`  ${propertyLinks.join(' | ')}`);
    
    // Contact/People Search links
    const contactLinks = [
      `<${lead.lookupLinks.truePeopleSearch}|TruePeople>`,
      `<${lead.lookupLinks.fastPeopleSearch}|FastPeople>`,
    ];
    lines.push(`  :telephone_receiver: ${contactLinks.join(' | ')}`);
    
    // Add note if links are based on defendant name due to low/missing address
    if (!hasGoodAddress) {
      lines.push(`  _:information_source: Links based on defendant name (address quality: ${lead.propertyAddress?.quality || 'none'})_`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Formats a filtered/bad lead for Slack display (shorter format)
 */
function formatFilteredLeadForSlack(lead: ClassifiedLead): string {
  const reason = sanitizeSlackText(lead.classification.stopReason || 'Unknown reason');
  const name = sanitizeSlackText(lead.defendant.name || lead.plaintiff.name || lead.id);
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
 * Adds lead content blocks, splitting into multiple sections if needed to stay under limits
 */
function addLeadBlocks(
  blocks: any[],
  leads: ClassifiedLead[],
  formatter: (lead: ClassifiedLead) => string,
  separator: string = '\n\n'
): void {
  if (leads.length === 0) return;
  
  // Format each lead and try to fit as many as possible per block
  let currentText = '';
  
  for (const lead of leads) {
    const leadText = sanitizeSlackText(formatter(lead));
    const potentialText = currentText 
      ? `${currentText}${separator}${leadText}`
      : leadText;
    
    // Leave buffer for safety
    if (potentialText.length > SLACK_LIMITS.SECTION_TEXT - 100) {
      // Save current block and start new one
      if (currentText) {
        blocks.push(createSectionBlock(currentText));
      }
      currentText = leadText;
    } else {
      currentText = potentialText;
    }
  }
  
  // Add remaining content
  if (currentText) {
    blocks.push(createSectionBlock(currentText));
  }
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
  blocks.push(createHeaderBlock(`Lis Pendens Report - ${new Date().toLocaleDateString()}`));
  
  // Summary section
  const summaryText = `Found *${leads.length}* leads: ` +
    `:white_check_mark: ${grouped.good.length} good | ` +
    `:eyes: ${grouped.review.length} need review | ` +
    `:x: ${grouped.bad.length} filtered out`;
  
  blocks.push(createSectionBlock(summaryText));
  blocks.push({ type: 'divider' });
  
  // Good leads section
  if (grouped.good.length > 0) {
    blocks.push(createSectionBlock(`:white_check_mark: *Good Leads (${grouped.good.length})*`));
    addLeadBlocks(blocks, grouped.good, formatLeadForSlack);
    blocks.push({ type: 'divider' });
  }
  
  // Needs review section
  if (grouped.review.length > 0) {
    blocks.push(createSectionBlock(`:eyes: *Needs Review (${grouped.review.length})*`));
    addLeadBlocks(blocks, grouped.review, formatLeadForSlack);
    blocks.push({ type: 'divider' });
  }
  
  // Filtered out section (collapsed format)
  if (grouped.bad.length > 0) {
    blocks.push(createSectionBlock(`:x: *Filtered Out (${grouped.bad.length})*`));
    addLeadBlocks(blocks, grouped.bad, formatFilteredLeadForSlack, '\n');
  }
  
  // Ensure we don't exceed block limit
  if (blocks.length > SLACK_LIMITS.BLOCKS_PER_MESSAGE) {
    console.warn(`[slack] Truncating blocks from ${blocks.length} to ${SLACK_LIMITS.BLOCKS_PER_MESSAGE}`);
    blocks.length = SLACK_LIMITS.BLOCKS_PER_MESSAGE;
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
