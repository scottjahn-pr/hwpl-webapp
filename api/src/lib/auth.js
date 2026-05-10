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

const extractPrincipalObjectId = (principal) => {
  const direct = principal?.userId;
  if (direct) return String(direct).toLowerCase();

  const claims = principal?.claims ?? [];
  const oidClaim = claims.find((claim) =>
    claim?.typ === "oid" ||
    claim?.type === "oid" ||
    claim?.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier" ||
    claim?.type === "http://schemas.microsoft.com/identity/claims/objectidentifier"
  );

  const value = oidClaim?.val ?? oidClaim?.value;
  return value ? String(value).toLowerCase() : "";
};

export const getPrincipalObjectId = (request) => {
  const principal = parsePrincipal(request.headers.get("x-ms-client-principal"));
  return extractPrincipalObjectId(principal);
};

export const isAuthenticated = (request) => {
  const principal = parsePrincipal(request.headers.get("x-ms-client-principal"));
  return Boolean(principal);
};

export const isAdmin = (request) => {
  const principal = parsePrincipal(request.headers.get("x-ms-client-principal"));

  // Allow local testing without authentication headers.
  if (!principal && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!principal) return false;

  const allowedAdminIds = parseAllowedAdminIds();
  const objectId = extractPrincipalObjectId(principal);
  if (allowedAdminIds.length > 0) {
    return Boolean(objectId && allowedAdminIds.includes(objectId));
  }

  const roles = principal?.userRoles ?? [];
  return roles.includes("admin");
};
