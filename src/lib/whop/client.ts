const WHOP_API_BASE = "https://api.whop.com/api/v1";

const INVALID_STATUSES = new Set([
  "canceled",
  "expired",
  "past_due",
  "unresolved",
]);

type WhopMembership = {
  id: string;
  status: string;
  license_key: string | null;
  product: { id: string } | null;
  user: { email: string } | null;
};

export async function getWhopMembershipByLicenseKey(
  licenseKey: string,
  apiKey: string
): Promise<WhopMembership | null> {
  const response = await fetch(
    `${WHOP_API_BASE}/memberships/${encodeURIComponent(licenseKey)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  return response.json();
}

export function isWhopMembershipValid(
  membership: WhopMembership,
  expectedProductId: string
): boolean {
  if (INVALID_STATUSES.has(membership.status)) return false;
  return membership.product?.id === expectedProductId;
}
