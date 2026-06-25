import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * AWS Cognito authentication helper.
 *
 * Cognito is used ONLY for authentication (proving who a user is). All
 * AUTHORIZATION — organizations, memberships, roles, per-resource access — is
 * owned by us in the database (see src/db/schema.ts: users.role, organizationId,
 * project_members, task visibility, etc.). Cognito has no "organizations"
 * concept; we model that ourselves.
 *
 * Recommended flow to build in Phase 1 (Cognito Hosted UI, OIDC Auth Code grant):
 *   GET  /login          -> redirect to the Cognito Hosted UI /authorize endpoint
 *   GET  /auth/callback  -> exchange the `code` for tokens, verify, set a session cookie
 *   middleware / layouts -> call getCurrentClaims() and load the DB user + role
 *
 * (A custom login form using Cognito's InitiateAuth API is also an option if you
 * want full branding control — Jason's call when we build the flow.)
 */

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function jwks(region: string, userPoolId: string) {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(
      new URL(
        `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      ),
    );
  }
  return jwksCache;
}

/**
 * Verifies a Cognito-issued JWT (id or access token) against the user pool's
 * public keys. Throws if the token is missing/expired/invalid.
 * `payload.sub` corresponds to `users.cognitoSub`.
 */
export async function verifyCognitoToken(token: string): Promise<JWTPayload> {
  const { env } = getCloudflareContext();
  const issuer = `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`;
  const { payload } = await jwtVerify(token, jwks(env.COGNITO_REGION, env.COGNITO_USER_POOL_ID), {
    issuer,
  });
  return payload;
}
