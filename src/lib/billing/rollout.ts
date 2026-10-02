const list = (value: string | undefined) => [
  ...new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];
export function plansEnabledForSchool(organizationId: string) {
  if (process.env.PLATFORM_PLANS_ENABLED !== "true") return false;
  const schools = list(process.env.PLATFORM_PLANS_PILOT_ORGANIZATION_IDS);
  const owners = list(process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS);
  return (
    schools.length > 0 && schools.length <= 5 && owners.length > 0 && owners.length <= 5 && schools.includes(organizationId)
  );
}
export function plansSignupAllowed(email: string) {
  if (process.env.PLATFORM_PLANS_ENABLED !== "true") return false;
  const schools = list(process.env.PLATFORM_PLANS_PILOT_ORGANIZATION_IDS);
  const owners = list(process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS).map((s) =>
    s.toLowerCase(),
  );
  return (
    schools.length > 0 && schools.length <= 5 && owners.length > 0 && owners.length <= 5 &&
    owners.includes(email.trim().toLowerCase())
  );
}
