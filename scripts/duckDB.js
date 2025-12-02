import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.30.0/+esm';
import apacheArrow from 'https://cdn.jsdelivr.net/npm/apache-arrow@21.1.0/+esm'

window.apacheArrow = apacheArrow;

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
const worker_url = URL.createObjectURL(
  new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
);
const worker = new Worker(worker_url);
const logger = new duckdb.ConsoleLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
URL.revokeObjectURL(worker_url);
await db.open({
  query: { castBigIntToDouble: true, castDecimalToDouble: true, castTimestampToDate: true },
})
const c = await db.connect();
export async function registerFile(file) {
  await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
  console.log(file.name, 'registered')
  //await db.registerFileURL('remote.parquet', 'https://origin/remote.parquet', DuckDBDataProtocol.HTTP, false);
  //const q = await c.query(sql);
  //const rows = q.toArray().map((row) => row.toJSON());
  //rows.columns = q.schema.fields.map((d) => d.name);
  //return rows;
};
export async function query(sql) {
  const q = await c.query(sql);
  const rows = q.toArray().map((row) => row.toJSON());
  rows.columns = q.schema.fields.map((d) => d.name);
  return rows;
};
export async function queryPersist(sql, tempTable) {
  await c.query(`
      CREATE OR REPLACE TEMP TABLE ${tempTable} AS
      ${sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').split(';')}
    `)
  const res = await query(`SELECT * FROM ${tempTable}`);
  res.schema = await query(`
      SELECT
        column_name AS col,
        column_type AS type
      FROM (DESCRIBE ${tempTable})
  `);
  return res;
};
export function q(sql) { query(sql).then(data => { console.log(data); }); }

window.c = c;
window.query = query;
window.q = q;