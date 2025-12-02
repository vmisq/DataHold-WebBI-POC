import { dbInit, dbGetByIndex, dbGetAll, dbGet, dbPut, dbDelete } from './indexedDB.js';
import { q, query, queryPersist, registerFile } from './duckDB.js';
//import clickhouseclientWeb from 'https://cdn.jsdelivr.net/npm/@clickhouse/client-web@1.13.0/+esm'

//dbInit('main', 'catalogExplorer', 'parentId', await query(`SELECT * FROM 'http://localhost:3000/assets/catalog-explorer.csv'`));
async function initData () {
    dbInit('main', [
        { store: 'publicUrl', index: null, data: [
            { id: "userdata", fileName: "userdata.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/userdata.parquet", fileType: "parquet" },
            { id: "table", fileName: "table.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/table.parquet", fileType: "parquet" },
            { id: "titanic", fileName: "titanic.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/titanic.parquet", fileType: "parquet" },
            { id: "iris", fileName: "iris.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/iris.parquet", fileType: "parquet" },
            { id: "taq", fileName: "taq.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/pq/taq.parquet", fileType: "parquet" },
            { id: "gold_vs_bitcoin", fileName: "gold_vs_bitcoin.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/pq/gold_vs_bitcoin.parquet", fileType: "parquet" },
            { id: "search_trends", fileName: "search_trends.parquet", filePath: "https://corsproxy.io/?https://www.timestored.com/data/sample/pq/search_trends.parquet", fileType: "parquet" },
        ]},
        { store: 'uploaded', index: null, data: []},
        { store: 'queries', index: null, data: [{ id: "iris_averages", name: "Iris Averages", sql: 'SELECT\n    iris."variety",\n    ROUND(AVG(iris."sepal.length"), 2) mean_sepal_length,\n    ROUND(AVG(iris."sepal.width"), 2) mean_sepal_width,\n    ROUND(AVG(iris."petal.length"), 2) mean_petal_length,\n    ROUND(AVG(iris."petal.width"), 2) mean_petal_width,\nFROM public_url.iris AS iris\nGROUP BY iris."variety"' }]},
        { store: 'charts', index: null, data: [
            JSON.parse('{"id":"iris_averages","name":"Iris Averages","dataJson":{"chartType":"bar/line","xAxisColumns":[{"name":"variety","expr":"variety","alias":"variety_NeCx","display":"variety"}],"groupBy":false,"yAxisColumns":[{"columns":[{"name":"mean_sepal_length","expr":"mean_sepal_length","agg":"COUNT(_col_)","alias":"mean_sepal_length_qpqx","display":"Mean Sepal Length","type":"line","fill":null,"color":null,"stack":"line_0"}],"colorBy":{}},{"columns":[{"name":"mean_sepal_width","expr":"mean_sepal_width","agg":"COUNT(_col_)","alias":"mean_sepal_width_npQH","display":"Mean Sepal Width","type":"line","fill":null,"color":null,"stack":"line_1"}],"colorBy":{}},{"columns":[{"name":"mean_petal_length","expr":"mean_petal_length","agg":"COUNT(_col_)","alias":"mean_petal_length_pOth","display":"Mean Petal Length","type":"line","fill":null,"color":null,"stack":"line_2"}],"colorBy":{}},{"columns":[{"name":"mean_petal_width","expr":"mean_petal_width","agg":"COUNT(_col_)","alias":"mean_petal_width_dpAM","display":"Mean Petal Width","type":"line","fill":null,"color":null,"stack":"line_3"}],"colorBy":{}}],"chartText":{"title":"Iris Averages","subtitle":"Average of each attribute per variety"},"chartDataSource":"q.iris_averages"},"configJson":{"type":"bar","options":{"scales":{"x":{"type":"category"}}}},"jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Mean Sepal Length","data":[5.01,5.94,6.59],"stack":"line_0","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"},{"label":"Mean Sepal Width","data":[3.43,2.77,2.97],"stack":"line_1","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"},{"label":"Mean Petal Length","data":[1.46,4.26,5.55],"stack":"line_2","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"},{"label":"Mean Petal Width","data":[0.25,1.33,2.03],"stack":"line_3","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Averages","subtitle":"Average of each attribute per variety"}}}'),
            JSON.parse(`{"id":"iris_sepal_length_ranges","name":"Iris Sepal Length Ranges","dataJson":{"chartType":"bar/line","xAxisColumns":[{"name":"variety","expr":"variety","alias":"variety_K4I2","display":"variety"}],"groupBy":true,"yAxisColumns":[{"columns":[{"name":"sepal.length","expr":"sepal.length","agg":"COUNT(_col_)","alias":"sepal_length_zyHD","display":"sepal.length","type":null,"fill":null,"color":null,"stack":"null_0"}],"colorBy":{"name":"_expr_","expr":"CASE WHEN \\"sepal.length\\" < 4.5 THEN 'Below 4.5' WHEN \\"sepal.length\\" > 5.5 THEN 'Above 5.5' ELSE 'Between 4.5 and 5.5' END","alias":"_expr__M7rm","display":"Ranges"}}],"chartText":{"title":"Iris Sepal Length Ranges","subtitle":""},"chartDataSource":"public_url.iris"},"configJson":{"type":"bar","options":{"scales":{"x":{"type":"category"}}}},"jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Above 5.5","data":[3,39,49],"stack":"null_0","type":null,"datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Below 4.5","data":[4,0,0],"stack":"null_0","type":null,"datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Between 4.5 and 5.5","data":[43,11,1],"stack":"null_0","type":null,"datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Sepal Length Ranges","subtitle":""}}}`),
            JSON.parse('{"id":"iris_sepal_width_min_max","name":"Iris Sepal Width Min-Max","dataJson":{"chartType":"bar/line","xAxisColumns":[{"name":"variety","expr":"variety","alias":"variety_K4I2","display":"variety"}],"groupBy":true,"yAxisColumns":[{"columns":[{"name":"sepal.width","expr":"sepal.width","agg":"MIN(_col_)","alias":"sepal_width_le4O","display":"Min Width","type":"bar","fill":null,"color":null,"stack":"bar_0"}],"colorBy":{}},{"columns":[{"name":"sepal.width","expr":"sepal.width","agg":"MAX(_col_)","alias":"sepal_width_rzKd","display":"Max Width","type":"bar","fill":null,"color":null,"stack":"bar_1"}],"colorBy":{}}],"chartText":{"title":"Iris Sepal Width Min-Max","subtitle":""},"chartDataSource":"public_url.iris"},"configJson":{"type":"bar","options":{"scales":{"x":{"type":"category"}}}},"jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Min Width","data":[2.3,2,2.2],"stack":"bar_0","type":"bar","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Max Width","data":[4.4,3.4,3.8],"stack":"bar_1","type":"bar","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Sepal Width Min-Max","subtitle":""}}}'),
            JSON.parse('{"id":"iris_petal_length","name":"Iris Petal Length","dataJson":{"chartType":"bar/line","xAxisColumns":[{"name":"variety","expr":"variety","alias":"variety_K4I2","display":"variety"}],"groupBy":true,"yAxisColumns":[{"columns":[{"name":"petal.length","expr":"petal.length","agg":"COUNT(_col_)","alias":"petal_length_FGo0","display":"Count","type":null,"fill":null,"color":null,"stack":"null_0"}],"colorBy":{}},{"columns":[{"name":"petal.length","expr":"petal.length","agg":"SUM(_col_)","alias":"petal_length_KfZG","display":"Sum","type":"line","fill":null,"color":null,"stack":"line_1"}],"colorBy":{}}],"chartText":{"title":"Iris Petal Length","subtitle":""},"chartDataSource":"public_url.iris"},"configJson":{"type":"bar","options":{"scales":{"x":{"type":"category"}}}},"jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Count","data":[50,50,50],"stack":"null_0","type":null,"datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Sum","data":[73.10000000000001,212.99999999999997,277.59999999999997],"stack":"line_1","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Petal Length","subtitle":""}}}'),
            JSON.parse('{"id":"iris_petal_width","name":"Iris Petal Width","dataJson":{"chartType":"bar/line","xAxisColumns":[],"groupBy":true,"yAxisColumns":[{"columns":[{"name":"petal.width","expr":"petal.width","agg":"SUM(_col_)","alias":"petal_width_b2az","display":"petal.width","type":"bar","fill":null,"color":null,"stack":"bar_0"}],"colorBy":{"name":"variety","expr":"variety","alias":"variety_K4I2","display":"variety"}},{"columns":[{"name":"petal.width","expr":"petal.width","agg":"COUNT(_col_)","alias":"petal_width_vCyJ","display":"Row Count","type":null,"fill":null,"color":null,"stack":"null_1"}],"colorBy":{}}],"chartText":{"title":"Iris Petal Width","subtitle":""},"chartDataSource":"public_url.iris"},"configJson":{"type":"bar","options":{"scales":{"x":{"type":"category"}}}},"jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Setosa","data":[12.299999999999995],"stack":"bar_0","type":"bar","datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Versicolor","data":[66.3],"stack":"bar_0","type":"bar","datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Virginica","data":[101.29999999999998],"stack":"bar_0","type":"bar","datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Row Count","data":[150],"stack":"null_1","type":null,"datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"}],"labels":[""]},"chartText":{"title":"Iris Petal Width","subtitle":""}}}'),
        ]},
        { store: 'dashboards', index: null, data: [
            JSON.parse('{"id":"sample_dashboard_iris_dataset","name":"Sample Dashboard - Iris Dataset","items":[{"id":"__text__c8vs","parentId":1,"name":"Sample Dashboard - Iris Dataset","data":{"id":"__text__c8vs","text":"Sample Dashboard - Iris Dataset"},"position":1000},{"id":"iris_averages_oGjI","parentId":1,"name":"Iris Averages","data":{"id":"iris_averages","jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Mean Sepal Length","data":[5.01,5.94,6.59],"stack":"line_0","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"},{"label":"Mean Sepal Width","data":[3.43,2.77,2.97],"stack":"line_1","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"},{"label":"Mean Petal Length","data":[1.46,4.26,5.55],"stack":"line_2","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"},{"label":"Mean Petal Width","data":[0.25,1.33,2.03],"stack":"line_3","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Averages","subtitle":"Average of each attribute per variety"}}},"position":2000},{"id":"iris_sepal_length_ranges_7nYw","parentId":"2","name":"Iris Sepal Length Ranges","data":{"id":"iris_sepal_length_ranges","jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Above 5.5","data":[3,39,49],"stack":"null_0","type":null,"datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Below 4.5","data":[4,0,0],"stack":"null_0","type":null,"datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Between 4.5 and 5.5","data":[43,11,1],"stack":"null_0","type":null,"datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Sepal Length Ranges","subtitle":""}}},"position":500},{"id":"iris_sepal_width_min_max_ndJZ","parentId":"2","name":"Iris Sepal Width Min-Max","data":{"id":"iris_sepal_width_min_max","jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Min Width","data":[2.3,2,2.2],"stack":"bar_0","type":"bar","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Max Width","data":[4.4,3.4,3.8],"stack":"bar_1","type":"bar","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Sepal Width Min-Max","subtitle":""}}},"position":1000},{"id":"iris_petal_length_b8LR","parentId":"3","name":"Iris Petal Length","data":{"id":"iris_petal_length","jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Count","data":[50,50,50],"stack":"null_0","type":null,"datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Sum","data":[73.10000000000001,212.99999999999997,277.59999999999997],"stack":"line_1","type":"line","datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"circle"}],"labels":["Setosa","Versicolor","Virginica"]},"chartText":{"title":"Iris Petal Length","subtitle":""}}},"position":500},{"id":"iris_petal_width_xJ78","parentId":"3","name":"Iris Petal Width","data":{"id":"iris_petal_width","jsonInput":{"type":"bar","options":{"scales":{"x":{"type":"category"}}},"data":{"datasets":[{"label":"Setosa","data":[12.299999999999995],"stack":"bar_0","type":"bar","datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Versicolor","data":[66.3],"stack":"bar_0","type":"bar","datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Virginica","data":[101.29999999999998],"stack":"bar_0","type":"bar","datalabels":{"anchor":"center","align":"center","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"},{"label":"Row Count","data":[150],"stack":"null_1","type":null,"datalabels":{"anchor":"end","align":"top","formatter":"hide0-maxDecimals2"},"pointStyle":"rect"}],"labels":[""]},"chartText":{"title":"Iris Petal Width","subtitle":""}}},"position":1000}],"groups":[{"id":1,"parentId":null,"name":"root","orientation":"v","position":0,"defaultSplitPosition":["5","37","69"]},{"id":2,"parentId":1,"name":"col2","orientation":"h","position":5000,"defaultSplitPosition":["37"]},{"id":3,"parentId":1,"name":"col3","orientation":"h","position":6000,"defaultSplitPosition":["66"]}]}'),
        ]},
    ], 8);
    await query(`
        CREATE SCHEMA IF NOT EXISTS public_url;
        CREATE SCHEMA IF NOT EXISTS uploaded;
        CREATE SCHEMA IF NOT EXISTS q;
    `)
    const initialPublic = await dbGetAll('main', 'publicUrl');
    initialPublic.forEach(({id,fileName,filePath,fileType}) => {
        query(`
            CREATE OR REPLACE VIEW public_url.${id} AS
            SELECT * FROM '${filePath}';
        `);
    });
    const initialUploaded = await dbGetAll('main', 'uploaded');
    initialUploaded.forEach(async ({id,fileName,file,fileType}) => {
        await registerFile(file);
        query(`
            CREATE OR REPLACE VIEW uploaded.${id} AS
            SELECT * FROM '${file.name}';
        `);
    });
    const initialQueries = await dbGetAll('main', 'queries');
    initialQueries.forEach(async ({id,name,sql}) => {
        query(`
            CREATE OR REPLACE VIEW q.${id} AS
            ${sql};
        `);
    });
}
await initData();
async function fetchFromPath(path) {
    //try {
    //    const response = await fetch(`https://BACKEND_URL/api/fetch_from_path?path=${path}`);
    //    if (!response.ok) {
    //        throw new Error(`HTTP error! status: ${response.status}`);
    //    }
    //    const data = await response.json();
    //} catch (error) {
    //    console.error('Error fetching data:', error);
    //};
    let data = [
        {
            path: 'file_storage[root]',
            type: 'root',
            node: 'file_storage',
            displayName: 'File Storage',
            children: [
                { type: 'folder', node: 'public_url', displayName: 'Public URL' },
                { type: 'folder', node: 's3', displayName: 's3' },
                { type: 'folder', node: 'gcs', displayName: 'GCS' },
                { type: 'folder', node: 'r2', displayName: 'Cloudflare R2' },
                { type: 'folder', node: 'az', displayName: 'Azure Blob Storage' },
                { type: 'folder', node: 'abfss', displayName: 'Azure Data Lake Storage' },
            ],
        },
        {
            path: 'file_storage[root]/public_url[folder]',
            type: 'folder',
            node: 'public_url',
            displayName: 'Public URL',
            children: [
                { type: 'file', node: 'userdata.parquet', displayName: 'userdata.parquet' },
                { type: 'file', node: 'table.parquet', displayName: 'table.parquet' },
                { type: 'file', node: 'titanic.parquet', displayName: 'titanic.parquet' },
                { type: 'file', node: 'iris.parquet', displayName: 'iris.parquet' },
                { type: 'file', node: 'taq.parquet', displayName: 'taq.parquet' },
                { type: 'file', node: 'gold_vs_bitcoin.parquet', displayName: 'gold_vs_bitcoin.parquet' },
                { type: 'file', node: 'search_trends.parquet', displayName: 'search_trends.parquet' },
            ],
        },
        { path: 'file_storage[root]/public_url[folder]/userdata.parquet[file]', type: 'file', node: 'userdata.parquet', displayName: 'userdata.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/userdata.parquet', alias: 'userdata' } },
        { path: 'file_storage[root]/public_url[folder]/table.parquet[file]', type: 'file', node: 'table.parquet', displayName: 'table.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/table.parquet', alias: 'table' } },
        { path: 'file_storage[root]/public_url[folder]/titanic.parquet[file]', type: 'file', node: 'titanic.parquet', displayName: 'titanic.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/titanic.parquet', alias: 'titanic' } },
        { path: 'file_storage[root]/public_url[folder]/iris.parquet[file]', type: 'file', node: 'iris.parquet', displayName: 'iris.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/iris.parquet', alias: 'iris' } },
        { path: 'file_storage[root]/public_url[folder]/taq.parquet[file]', type: 'file', node: 'taq.parquet', displayName: 'taq.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/pq/taq.parquet', alias: 'taq' } },
        { path: 'file_storage[root]/public_url[folder]/gold_vs_bitcoin.parquet[file]', type: 'file', node: 'gold_vs_bitcoin.parquet', displayName: 'gold_vs_bitcoin.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/pq/gold_vs_bitcoin.parquet', alias: 'gold_vs_bitcoin' } },
        { path: 'file_storage[root]/public_url[folder]/search_trends.parquet[file]', type: 'file', node: 'search_trends.parquet', displayName: 'search_trends.parquet', config: { url: 'https://corsproxy.io/?https://www.timestored.com/data/sample/pq/search_trends.parquet', alias: 'search_trends' } },
        {
            path: 'external_databases[root]',
            type: 'root',
            node: 'external_databases',
            displayName: 'External Databases',
            children: [
                { type: 'db-https', node: 'clickhouse_playground', displayName: 'ClickHouse Playground' },
            ],
        },
        {
            path: 'external_databases[root]/clickhouse_playground[db-https]',
            type: 'db-https',
            node: 'clickhouse_playground',
            displayName: 'ClickHouse Playground',
            config: {
                endpoint: 'https://play.clickhouse.com:443/',
                user: 'play',
            },
        },
        {
            path: 'temp[root]',
            type: 'root',
            node: 'temp',
            displayName: 'Temp',
            children: [
                { type: 'db', node: 'duckdb', displayName: 'DuckDB' },
                { type: 'db', node: 'indexeddb', displayName: 'IndexedDB' },
            ],
        },
    ];
    data.forEach(element => {
        console.log(element);
        dbPut('main', 'cePaths', element.path, element.children);
        if (element.type=='file' && element.config?.url) {
            const pathParts = element.path.replace(/\[.*?\]/g, "").split('/');
            query(`
                CREATE SCHEMA IF NOT EXISTS ${pathParts[1]};
                CREATE OR REPLACE VIEW ${pathParts[1]}.${element.config.alias} AS
                SELECT * FROM '${element.config.url}';
            `);
        };
    });
};

export async function backendRegisterPublicUrl(id, url, type) {
    try {
        id = id.toLowerCase();
        new URL(url);
        await query(`
            CREATE OR REPLACE VIEW public_url.${id} AS
            SELECT * FROM 'https://corsproxy.io/?${url}';
        `);
        dbPut('main', 'publicUrl', {id: id, fileName: `${id}.${type}`, filePath: url, fileType: type});
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendRemovePublicUrl(id) {
    try {
        await query(`
            DROP VIEW IF EXISTS public_url.${id};
        `);
        dbDelete('main', 'publicUrl', id);
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendRegisterUpload(id, file, type) {
    try {
        id = id.toLowerCase();
        registerFile(file);
        await query(`
            CREATE OR REPLACE VIEW uploaded.${id} AS
            SELECT * FROM '${file.name}';
        `);
        dbPut('main', 'uploaded', {id: id, fileName: `${id}.${type}`, file: file, fileType: type});
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendRemoveUpload(id) {
    try {
        await query(`
            DROP VIEW IF EXISTS uploaded.${id};
        `);
        dbDelete('main', 'uploaded', id);
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendRegisterQuery(id, name, sql) {
    try {
        id = id.toLowerCase();
        await query(`
            CREATE OR REPLACE VIEW q.${id} AS
            ${sql};
        `);
        dbPut('main', 'queries', {id: id, name: name, sql: sql});
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendRemoveQuery(id) {
    try {
        await query(`
            DROP VIEW IF EXISTS q.${id};
        `);
        dbDelete('main', 'queries', id);
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendListQueries() {
    try {
        const queries = await dbGetAll('main', 'queries');
        return queries.map(q => ({name: q.name, value: `q.${q.id}`}));
    } catch (err) {
        return err;
    }
}

export async function backendListTables() {
    try {
        const publicUrl = (await dbGetAll('main', 'publicUrl')).map(q => ({name: q.id, value: `public_url.${q.id}`}));
        const uploaded = (await dbGetAll('main', 'uploaded')).map(q => ({name: q.id, value: `uploaded.${q.id}`}));
        return [
            { group: {key: 'Public URL', value: 'public_url'}, opts: publicUrl },
            { group: {key: 'Uploaded', value: 'uploaded'}, opts: uploaded },
        ]
    } catch (err) {
        return err;
    }
}

export async function backendRegisterChart(id, name, dataJson, configJson, jsonInput) {
    try {
        const data = {id: id, name: name, dataJson: dataJson, configJson: configJson, jsonInput: jsonInput};
        console.log(data);
        dbPut('main', 'charts', data);
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendRemoveChart(id) {
    try {
        dbDelete('main', 'charts', id);
        return true;
    } catch (err) {
        return err;
    }
}

export async function backendListCharts() {
    try {
        const queries = await dbGetAll('main', 'charts');
        return queries.map(q => ({name: q.name, id: q.id}));
    } catch (err) {
        return err;
    }
}

//await fetchFromPath('');
async function backendFileStorageChildren(id) {
    let children = [];
    console.log(id);
    if (id==='ce-root-file-storage') {
        return [
            {
                id: 'ce-root-file-storage-public-url',
                displayName: 'Public URL',
                type: 'storage-type',
            },{
                id: 'ce-root-file-storage-uploaded',
                displayName: 'Uploaded',
                type: 'storage-type',
            },{
                id: 'ce-root-file-storage-more',
                displayName: 'More options in progress (S3, Azure, GCS, ...)',
                type: 'exception',
            },
        ]
    }
    if (id==='ce-root-file-storage-public-url') {
        (await dbGetAll('main', 'publicUrl')).forEach(({id,fileName,filePath,fileType}) => {
            children.push({
                id: `ce-root-file-storage-public-url-child-${id}`,
                displayName: id,
                type: `file-${fileType}`
            })
        });
        return children;
    }
    if (id.startsWith('ce-root-file-storage-public-url-child')) {
        let schema = null;
        if (!schema) {
            schema = await query(`
                SELECT column_name as id, column_name as displayName, 'column' as type
                FROM information_schema.columns
                WHERE table_catalog = 'memory'
                AND table_schema = 'public_url'
                AND table_name = '${id.split('ce-root-file-storage-public-url-child-').pop()}'
            `)
            return schema;
        }
    }
    if (id==='ce-root-file-storage-uploaded') {
        let files = await dbGetAll('main', 'uploaded')
        if (files.length>0) {
            files.forEach(({id,fileName,filePath,fileType}) => {
                children.push({
                    id: `ce-root-file-storage-uploaded-child-${id}`,
                    displayName: id,
                    type: `file-${fileType}`
                })
            })
        } else {
            children.push({
                id: `ce-root-file-storage-uploaded-none`,
                displayName: 'No upload found. Try uploading a file.',
                type: `exception`
            })
        };
        return children;
    }
    if (id.startsWith('ce-root-file-storage-uploaded-child')) {
        let schema = null;
        if (!schema) {
            schema = await query(`
                SELECT column_name as id, column_name as displayName, 'column' as type
                FROM information_schema.columns
                WHERE table_catalog = 'memory'
                AND table_schema = 'uploaded'
                AND table_name = '${id.split('ce-root-file-storage-uploaded-child-').pop()}'
            `)
            return schema;
        }
    }
    return [{
        id: 'ce-path-unknown',
        displayName: `That's strange... How did you get here?`,
        type: 'exception',
    }];
}

async function backendPerspectivesChildren(id) {
    return [];
}

async function backendSavedQueriesChildren(id) {
    let children = [];
    if (id==='ce-root-saved-queries') {
        let queries = await dbGetAll('main', 'queries')
        queries.forEach(q => {
            children.push({
                id: `ce-root-saved-queries-child-${q.id}`,
                displayName: q.name,
                type: 'query',
            })
        })
        return children;
    }
    if (id.startsWith('ce-root-saved-queries-child')) {
        let schema = null;
        if (!schema) {
            schema = await query(`
                SELECT column_name as id, column_name as displayName, 'column' as type
                FROM information_schema.columns
                WHERE table_catalog = 'memory'
                AND table_schema = 'q'
                AND table_name = '${id.split('ce-root-saved-queries-child-').pop()}'
            `)
            return schema;
        }
    }
    return [{
        id: 'ce-path-unknown',
        displayName: `That's strange... How did you get here?`,
        type: 'exception',
    }];;
}

export async function backendCatalogExplorerChildren(id) {
    let children;
    if (id.startsWith('ce-root-data-marts')) {
        return [{
            id: 'ce-root-data-marts-org-only',
            displayName: 'This feature is only available for organizations',
            type: 'exception',
        }];
    } else if (id.startsWith('ce-root-data-warehouse')) {
        return [{
            id: 'ce-root-data-warehouse-org-only',
            displayName: 'This feature is only available for organizations',
            type: 'exception',
        }];
    } else if (id.startsWith('ce-root-external-databases')) {
        return [{
            id: 'ce-root-external-databases-org-app',
            displayName: 'This feature is only available for organizations or in the desktop application',
            type: 'exception',
        }];
    } else if (id.startsWith('ce-root-file-storage')) {
        children = await backendFileStorageChildren(id)
        return children;
    } else if (id.startsWith('ce-root-perspectives')) {
        children = await backendPerspectivesChildren(id)
        return children.length>0 ? children : [{
            id: 'ce-root-perspectives-none',
            displayName: 'No perspectives found. Try saving a perspective in query editor.',
            type: 'exception',
        }];
    } else if (id.startsWith('ce-root-saved-queries')) {
        children = await backendSavedQueriesChildren(id)
        return children.length>0 ? children : [{
            id: 'ce-root-perspectives-none',
            displayName: 'No saved queries found. Try saving a query in query editor.',
            type: 'exception',
        }];
    } else {
        return [{
            id: 'ce-path-unknown',
            displayName: `That's strange... How did you get here?`,
            type: 'exception',
        }];
    };
};

export async function backendQueryEditorExecute(sql, persistAs=null) {
    async function queryClickhouse(client, sql) {
        //const resultSet = await client.query({
        //    query: sql,
        //    format: 'JSONEachRow',
        //});
        //const reader = resultSet.stream().getReader()
        //const allRows = [];
        //while (true) {
        //    const { done, value: rows } = await reader.read()
        //    if (done) { break }
        //    rows.forEach(row => {
        //        allRows.push(row.json());
        //    });
        //};
        //return allRows;
        const result = await query(`
            INSTALL chsql FROM community; -- or chsql_native for binary
            LOAD chsql;
            SELECT * FROM ch_scan("${sql}", "${client}");
        `);
        console.log(result);
        return result
    };
    console.log(sql);
    try {
        const qFn = persistAs ? (sql) => queryPersist(sql, persistAs) : query;
        if (sql.toLowerCase().includes('clickhouse')) {
            //const client = clickhouseclientWeb.createClient({
            //    url: 'https://play.clickhouse.com:443/',
            //    username: 'play',
            //})
            //return await queryClickhouse(client, sql);
            const client = 'https://play@play.clickhouse.com';
            return await queryClickhouse(client, sql);
        };
        const res = await qFn(sql);
        return res;
    } catch (err) {
        return err;
    }
};

export async function backendFetchQueriable(catalog=null,schema=null) {
    return await query(`
        SELECT table_schema as schema, table_name as table, ARRAY_AGG(column_name) as columns
        FROM information_schema.columns
        WHERE 1=1
        ${schema ? "AND table_catalog = '" + catalog + "'" : ''}
        ${schema ? "AND table_schema = '" + schema + "'" : ''}
        GROUP BY ALL
    `)
}

export async function backendFetchColumns(q=null) {
    console.log(q);
    let where = '';
    if (!q) { where = `
        WHERE table_catalog = 'temp'
        AND table_schema = 'main'
        AND table_name = '_active'
    `} else { where = `
        WHERE table_catalog = 'memory'
        AND table_schema ='${q.split('.')[0]}'
        AND table_name ='${q.split('.').pop()}'
    `}
    try {
        const res = await query(`
            SELECT data_type, column_name 
            FROM information_schema.columns
            ${where}
            ORDER BY ALL ASC
        `);
        return res;
    } catch (err) {
        return err;
    };
};
