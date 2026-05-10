const parsePrincipal = (headerValue) => {
  if (!headerValue) return null;

  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const isAdmin = (request) => {
  const principal = parsePrincipal(request.headers.get("x-ms-client-principal"));

  // Allow local testing without authentication headers.
  if (!principal && process.env.NODE_ENV !== "production") {
    return true;
  }

  const roles = principal?.userRoles ?? [];
  return roles.includes("admin") || roles.includes("authenticated");
};
