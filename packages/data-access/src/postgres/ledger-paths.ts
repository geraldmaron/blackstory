/** Temporary path vocabulary used by proposal producers during relational cutover. */
export const ledgerPaths = {
  researchCase: (caseId: string) => `researchCases/${caseId}`,
  submissionInbox: (submissionId: string) => `submissionInbox/${submissionId}`,
  entityLocation: (entityId: string, locationId: string) =>
    `canonicalEntities/${entityId}/locations/${locationId}`,
  catalogDecision: (entityId: string) => `catalogDecisions/${entityId}`,
  sourceOrganization: (organizationId: string) => `sourceOrganizations/${organizationId}`,
  killSwitch: (switchId: string) => `killSwitches/${switchId}`,
} as const;
