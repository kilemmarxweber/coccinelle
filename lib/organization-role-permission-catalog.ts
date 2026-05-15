/**
 * Charge utile des permissions de rôle d’organisation (contrôle d’accès Better Auth).
 * Structure alignée sur `authAccessControl` côté serveur ; typage large pour le client.
 */
export type OrganizationRolePermissionPayload = Record<string, unknown>;
