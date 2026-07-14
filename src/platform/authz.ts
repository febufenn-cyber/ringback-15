import type { AuthPrincipal, Capability, OrganizationMembership, OrganizationRole, PlatformStore } from "./types.js";

const ROLE_CAPABILITIES: Readonly<Record<OrganizationRole, ReadonlySet<Capability>>> = {
  owner: new Set([
    "organization.read", "organization.manage", "members.read", "members.manage", "locations.read",
    "locations.manage", "lines.read", "lines.manage", "lines.activate", "leads.read", "leads.manage",
    "billing.read", "billing.manage", "audit.read", "support.manage",
  ]),
  admin: new Set([
    "organization.read", "organization.manage", "members.read", "members.manage", "locations.read",
    "locations.manage", "lines.read", "lines.manage", "lines.activate", "leads.read", "leads.manage",
    "billing.read", "audit.read", "support.manage",
  ]),
  operator: new Set(["organization.read", "locations.read", "lines.read", "leads.read", "leads.manage"]),
  viewer: new Set(["organization.read", "locations.read", "lines.read", "leads.read"]),
  billing: new Set(["organization.read", "billing.read", "billing.manage"]),
};

export function roleAllows(role: OrganizationRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export async function requireCapability(
  store: PlatformStore,
  principal: AuthPrincipal,
  organizationId: string,
  capability: Capability,
): Promise<OrganizationMembership> {
  if (principal.platformAdmin) {
    return {
      organizationId,
      userId: principal.userId,
      role: "owner",
      state: "active",
      invitedBy: principal.userId,
      createdAt: new Date(0).toISOString(),
      acceptedAt: new Date(0).toISOString(),
    };
  }
  const membership = await store.getMembership(organizationId, principal.userId);
  if (!membership || membership.state !== "active") {
    throw new Error("organization_access_denied");
  }
  if (!roleAllows(membership.role, capability)) {
    throw new Error(`capability_denied:${capability}`);
  }
  return membership;
}
