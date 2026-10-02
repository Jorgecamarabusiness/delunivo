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
  return (
    schools.length <= 5 && (!schools.length || schools.includes(organizationId))
  );
}
export function plansSignupAllowed(email: string) {
  const owners = list(process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS).map((s) =>
    s.toLowerCase(),
  );
  return (
    owners.length <= 5 &&
    (!owners.length || owners.includes(email.toLowerCase()))
  );
}
