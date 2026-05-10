export const json = (body, status = 200) => ({
  status,
  jsonBody: body,
  headers: {
    "content-type": "application/json"
  }
});

export const csv = (content, fileName = "export.csv") => ({
  status: 200,
  body: content,
  headers: {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename=${fileName}`
  }
});

export const parseJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const badRequest = (message) => json({ error: message }, 400);
export const unauthorized = () => json({ error: "Admin role required." }, 403);
export const serverError = (message) => json({ error: message }, 500);
