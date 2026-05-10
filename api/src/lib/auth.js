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
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
};

const extractPrincipalObjectId = (principal) => {
  const direct = principal?.userId;
  if (direct) return String(direct).toLowerCase();

  const claims = principal?.claims ?? [];
  const oidClaim = claims.find((claim) =>
    claim?.typ === "oid" ||
    claim?.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier"
  );

  return oidClaim?.val ? String(oidClaim.val).toLowerCase() : "";
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
