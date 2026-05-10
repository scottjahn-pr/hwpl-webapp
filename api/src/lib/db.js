import sql from "mssql";

let poolPromise;

export const getPool = async () => {
  if (!poolPromise) {
    const connectionString = process.env.SQL_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("Missing SQL_CONNECTION_STRING setting.");
    }

    poolPromise = sql.connect(connectionString);
  }

  return poolPromise;
};

export const runQuery = async (queryText, params = []) => {
  const pool = await getPool();
  const request = pool.request();

  for (const param of params) {
    const { name, type, value } = param;
    request.input(name, type, value);
  }

  return request.query(queryText);
};

export { sql };
