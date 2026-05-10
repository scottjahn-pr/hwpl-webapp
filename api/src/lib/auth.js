const parsePrincipal = (headerValue) => {
  if (!headerValue) return null;

  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const parseAllowedAdminIds = () => {
  const raw = process.env.ADMIN_ENTRA_OBJECT_IDS ?? "";
  if (!raw.trim()) return [];

  return raw
    .split(/[;,\n]/)
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
};

  const normalize = (value) => (value ? String(value).trim().toLowerCase() : "");

  const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const extractPrincipalObjectId = (principal) => {
  const direct = principal?.userId;
  if (direct) return normalize(direct);

  const claims = principal?.claims ?? [];
  const oidClaim = claims.find((claim) =>
    claim?.typ === "oid" ||
    claim?.type === "oid" ||
    claim?.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier" ||
    claim?.type === "http://schemas.microsoft.com/identity/claims/objectidentifier"
  );

  const value = oidClaim?.val ?? oidClaim?.value;
  return normalize(value);
};

const extractCandidateIds = (principal, principalIdHeader) => {
  const claims = principal?.claims ?? [];

  const claimValue = (types) => {
    const match = claims.find((claim) => types.includes(claim?.typ) || types.includes(claim?.type));
    return normalize(match?.val ?? match?.value);
  };

  const oid = extractPrincipalObjectId(principal);
  const principalId = normalize(principalIdHeader);
  const userId = normalize(principal?.userId);
  const subject = claimValue(["sub", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]);

  return unique([oid, principalId, userId, subject]);
};

export const getPrincipalDetails = (request) => {
  const principalHeader = request.headers.get("x-ms-client-principal");
  const principalIdHeader = request.headers.get("x-ms-client-principal-id");
  const principalNameHeader = request.headers.get("x-ms-client-principal-name");

  const principal = parsePrincipal(principalHeader);
  const candidateIds = extractCandidateIds(principal, principalIdHeader);

  return {
    isAuthenticated: Boolean(principal || principalIdHeader),
    objectId: candidateIds[0] ?? "",
    principalName: principalNameHeader ?? "",
    candidateIds,
    roles: principal?.userRoles ?? []
  };
};

export const getPrincipalObjectId = (request) => {
  return getPrincipalDetails(request).objectId;
};

export const isAuthenticated = (request) => {
  return getPrincipalDetails(request).isAuthenticated;
};

export const isAdmin = (request) => {
  const principal = parsePrincipal(request.headers.get("x-ms-client-principal"));
  const details = getPrincipalDetails(request);

  // Allow local testing without authentication headers.
  if (!principal && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!details.isAuthenticated) return false;

  const allowedAdminIds = parseAllowedAdminIds();
  if (allowedAdminIds.length > 0) {
    return details.candidateIds.some((id) => allowedAdminIds.includes(id));
  }

  const roles = details.roles;
  return roles.includes("admin");
};
