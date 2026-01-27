// apps/backend/src/notifications/markdown.ts
import { ParsedAddress } from "../utils/address-parser";

export function formatAddressesMarkdown(
  addresses: ParsedAddress[],
  maxItems = 20
): string {
  if (addresses.length === 0) {
    return '_No addresses found._';
  }

  const visible = addresses.slice(0, maxItems);
  const remaining = addresses.length - visible.length;

  const list = visible.map((addr) => `• \`${addr}\``).join('\n');

  return [
    '*Addresses Found:*',
    list,
    ...(remaining > 0
      ? [`_…and ${remaining} more not shown_`]
      : []),
  ].join('\n');
}
