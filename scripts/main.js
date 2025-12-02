import {
    backendCatalogExplorerChildren,
    backendQueryEditorExecute,
    backendFetchColumns,
    backendFetchQueriable,
    backendRegisterPublicUrl,
    backendRemovePublicUrl,
    backendRegisterUpload,
    backendRemoveUpload,
    backendRegisterQuery,
    backendRemoveQuery,
    backendListQueries,
    backendListTables,
    backendRegisterChart,
    backendRemoveChart,
    backendListCharts,
} from './backend.js';
import { dbDelete, dbGet, dbGetAll, dbPut } from './indexedDB.js';

//#region Shared Objects
let activeQueryResults;
const activeQueryTarget = new EventTarget();
Object.defineProperty(window, 'activeQueryResults', {
    get: () => activeQueryResults,
    configurable: true
});

let sqlCompletionProvider;

async function setupSQLAutocomplete() {
    // Dispose previous provider if exists
    if (sqlCompletionProvider) {
        sqlCompletionProvider.dispose();
    }

    const sqlKeywords = [
        // Standard query keywords
        'SELECT', 'FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
        'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
        'WITH', 'DISTINCT',
        // Aggregates
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
        // Window functions
        'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE',
        // Analytic clauses
        'OVER', 'PARTITION BY', 'ORDER BY'
    ];

    const schemaInfoRaw = await backendFetchQueriable();
    const schemaInfo = schemaInfoRaw.map(t => ({
        schema: t.schema,
        table: t.table,
        columns: t.columns.toArray()
    }));

    sqlCompletionProvider = monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: function (model, position) {
            const text = model.getValue(); // entire script

            // Track all tables in script
            const tablesInUse = {};
            const tableRegex = /\b(FROM|JOIN)\s+([^\s;]+)(?:\s+(?:AS\s+)?(\w+))?/gi;
            let match;
            while ((match = tableRegex.exec(text)) !== null) {
                const tableName = match[2];
                const alias = match[3] || tableName;
                tablesInUse[alias] = tableName;
            }
            console.log(tablesInUse);

            const currentLineText = model.getLineContent(position.lineNumber).slice(0, position.column - 1).toUpperCase();
            const suggestions = [];
            const addedLabels = new Set();

            // Suggest tables only after FROM / JOIN in current line
            if (/\bFROM\b|\bJOIN\b/.test(currentLineText)) {
                for (const t of schemaInfo) {
                    const label = t.schema ? `"${t.schema}"."${t.table}" ${toSnakeCase(t.table)}` : `"${t.table}"`;
                    if (!addedLabels.has(label)) {
                        suggestions.push({
                            label,
                            kind: monaco.languages.CompletionItemKind.Reference,
                            insertText: label
                        });
                        addedLabels.add(label);
                    }
                }
            }

            // Columns: only for tables found anywhere in script
            for (const alias in tablesInUse) {
                const tableName = tablesInUse[alias].split('.').pop().replaceAll('"', '');
                const schemaName = tablesInUse[alias].includes('.') ? tablesInUse[alias].split('.')[0].replaceAll('"', '') : null;
                const tableInfo = schemaInfo.find(t => t.table === tableName && (t.schema === schemaName || !schemaName));
                console.log(tableName, tableInfo);
                if (!tableInfo) continue;

                for (const col of tableInfo.columns) {
                    const label = alias ? `${alias}."${col}"` : `"${col}"`;
                    if (!addedLabels.has(label)) {
                        suggestions.push({
                            label,
                            kind: monaco.languages.CompletionItemKind.Field,
                            insertText: label
                        });
                        addedLabels.add(label);
                    }
                }
            }

            // Keywords
            for (const k of sqlKeywords) {
                if (!addedLabels.has(k)) {
                    suggestions.push({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k
                    });
                    addedLabels.add(k);
                }
            }

            return { suggestions };
        }
    });
}

function initComponents() {
    Array.from(document.querySelectorAll('.switch-button')).forEach(el => el.addEventListener('click', (ev) => {
        const classList = ev.target.classList;
        if (classList.contains('active')) {
            classList.remove('active')
        } else {
            classList.add('active')
        }
    }))
    setupSQLAutocomplete();
}

function showAlert(message, duration = 2000) {
    const box = document.getElementById('alert-box');
    box.textContent = message;
    box.classList.add('show');

    setTimeout(() => {
        box.classList.remove('show');
    }, duration);
}
//#endregion

//#region Helper Functions
const toTitleCase = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const toSnakeCase = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^\w]+/g, '_').replace(/^(\d)/, '_$1').toLowerCase();

function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, x => chars[x % chars.length]).join('');
}
function getNthNextSibling(el, n) {
    let current = el;
    for (let i = 0; i < n; i++) {
        if (!current) return null;
        current = current.nextElementSibling;
    }
    return current;
}
function getNthPreviousSibling(el, n) {
    let current = el;
    for (let i = 0; i < n; i++) {
        if (!current) return null;
        current = current.previousElementSibling;
    }
    return current;
}
function removeNextOrPreviousElement(el) {
    if (el.nextElementSibling) {
        el.nextElementSibling.remove();
    } else {
        el.previousElementSibling?.remove();
    };
    el.remove();
};
//#endregion

//#region Resizable
function makeResizable(container) {
    let activeHandle = null;
    const resetBtn = document.querySelector('.resizable-reset-btn');
    const handles = Array.from(container.querySelectorAll(':scope > .handle'));

    function setFlexFromHandles() {
        let currentPosition = 0;
        let lastChild = null
        container.childNodes.forEach((child, i) => {
            if (child.classList.contains('handle')) {
                const splitPosition = child.getAttribute('data-split-position');
                container.children[i - 1].style.flex = splitPosition - currentPosition;
                currentPosition = splitPosition;
            }
            lastChild = child;
        });
        if (lastChild) {
            lastChild.style.flex = 100 - currentPosition;
        };
    }

    function resize(e) {
        let initialSplitPositions = handles.map(x => x.getAttribute('data-initial-split-position'));
        if (!activeHandle) return;
        const containerRect = container.getBoundingClientRect();
        let newSplitPosition
        if (container.classList.contains('h-resizable')) {
            newSplitPosition = ((e.clientX - containerRect.left) / containerRect.width * 100);
        } else {
            newSplitPosition = ((e.clientY - containerRect.top) / containerRect.height * 100);
        };
        newSplitPosition = Math.round(Math.max(0, Math.min(newSplitPosition, 100)));
        activeHandle.setAttribute('data-split-position', newSplitPosition);
        let beforeactiveHandle = true
        handles.forEach((h, i) => {
            if (h == activeHandle) {
                beforeactiveHandle = false;
            };
            const curSplitPosition = h.getAttribute('data-split-position');
            if (beforeactiveHandle) {
                h.setAttribute('data-split-position', Math.min(newSplitPosition, Math.max(curSplitPosition, initialSplitPositions[i])));
            } else {
                h.setAttribute('data-split-position', Math.max(newSplitPosition, Math.min(curSplitPosition, initialSplitPositions[i])));
            };
        });
        setFlexFromHandles(container);
    }

    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        activeHandle = null;
    }

    function setDefaultSplitPositions() {
        handles.forEach(h => {
            h.setAttribute('data-split-position', h.getAttribute('data-default-split-position'));
        });
    }

    handles.forEach(h => {
        h.addEventListener('mousedown', e => {
            activeHandle = h;
            activeHandle.classList.add('active-handle');
            handles.forEach(x => x.setAttribute('data-initial-split-position', x.getAttribute('data-split-position')));
            document.addEventListener('mousemove', e => resize(e));
            document.addEventListener('mouseup', e => { activeHandle?.classList.remove('active-handle'); stopResize(); });
            e.preventDefault();
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            setDefaultSplitPositions(handles);
            setFlexFromHandles(container);
        });
    };

    setDefaultSplitPositions();
    setFlexFromHandles();
};
function initResizable() {
    Array.from(document.querySelectorAll('.h-resizable, .v-resizable')).forEach(
        c => makeResizable(c)
    );
};
//#endregion

//#region Catalog Explorer
function makeCatalogExplorer(catalog) {
    //const optionsIcon = 'fa-solid fa-ellipsis'
    async function toggleOpenClose(catalog) {
        catalog.classList.toggle('ce-open');
        catalog.classList.toggle('ce-closed');
        if (!catalog.getElementsByTagName('li').length) {
            const id = catalog.id;
            console.log(id);
            const catalogItems = await backendCatalogExplorerChildren(id);
            console.log(catalogItems);
            const catalogLevel = parseInt(getComputedStyle(catalog.querySelector('.ce-header')).getPropertyValue('--ce-level') ?? 0);

            catalogItems.forEach(({ id, displayName, type }) => {
                const li = document.createElement('li');
                const div = document.createElement('div');
                div.className = `ce-header ce-header-type-${type}`;
                div.style.setProperty('--ce-level', catalogLevel + 1);
                const divText = document.createElement('div');
                divText.className = "ce-header-text";
                const span = document.createElement('span');
                span.textContent = displayName;
                const divBtn = document.createElement('div');
                divBtn.className = "ce-header-btn-group";

                if (!(['exception', 'column'].includes(type))) {
                    if (type == 'storage-type') {
                        const buttonRefresh = document.createElement('button');
                        buttonRefresh.className = "icon-button refresh";
                        const buttonEdit = document.createElement('button');
                        buttonEdit.className = "icon-button edit";
                        divBtn.appendChild(buttonRefresh);
                        buttonEdit.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            const modal = document.getElementById(`${id}-modal`);
                            const dialog = modal.querySelector('.modal-dialog');
                            const rect = ev.target.getBoundingClientRect();
                            const x = rect.right;
                            const y = rect.top;
                            dialog.style.left = x + "px";
                            dialog.style.top = y + "px";

                            const idInput = document.getElementById(`${id}-modal-id`);
                            const urlInput = document.getElementById(`${id}-modal-url`);
                            const fileInput = document.getElementById(`${id}-modal-file`);
                            const typeInput = document.getElementById(`${id}-modal-type`);
                            const urlMsg = document.getElementById(`${id}-modal-url-msg`);
                            const fileMsg = document.getElementById(`${id}-modal-file-msg`);
                            const submitMsg = document.getElementById(`${id}-modal-submit-msg`);

                            typeInput.value = '';
                            idInput.value = '';
                            submitMsg.textContent = null;

                            typeInput.parentNode.style.display = 'none';
                            idInput.parentNode.style.display = 'none';

                            if (urlInput) {
                                urlInput.value = '';
                                urlMsg.textContent = null;
                            };
                            if (fileInput) { fileInput.value = null };

                            if (urlMsg) { };
                            if (fileMsg) { fileMsg.textContent = null };

                            idInput.addEventListener('input', (ev) => {
                                const id = ev.target.value;
                                submitMsg.textContent = null;
                                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) {
                                    submitMsg.textContent = `${id} is not valid.`
                                    return;
                                }
                            })

                            modal.classList.toggle('open');
                        });
                        buttonRefresh.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            const ul = ev.target.closest('ul');
                            Array.from(ul.querySelectorAll(':scope > li')).forEach(el => el.remove());
                            ul.classList.remove('ce-closed');
                            ul.classList.remove('ce-open');
                            ul.classList.add('ce-closed');
                            toggleOpenClose(ul);
                            setupSQLAutocomplete();
                        });
                        divBtn.appendChild(buttonRefresh);
                        divBtn.appendChild(buttonEdit);
                    } else if (type.startsWith('file-') || type == 'query') {
                        const buttonRemove = document.createElement('button');
                        buttonRemove.className = "icon-button remove";
                        buttonRemove.addEventListener('click', async (ev) => {
                            ev.stopPropagation();
                            const li = ev.target.closest('li');
                            let id = li.querySelector('ul').id;
                            let res;
                            if (id.startsWith('ce-root-file-storage-public-url-')) {
                                id = id.split('ce-root-file-storage-public-url-child-').pop()
                                if (!confirm(`Remove Public URL ${id}? U sure? LOL`)) { return; };
                                res = await backendRemovePublicUrl(id);
                            } else if (id.startsWith('ce-root-file-storage-uploaded-')) {
                                id = id.split('ce-root-file-storage-uploaded-child-').pop()
                                if (!confirm(`Remove Uploaded ${id}? U sure? LOL`)) { return; };
                                res = await backendRemoveUpload(id);
                            } else if (id.startsWith('ce-root-saved-queries-')) {
                                id = id.split('ce-root-saved-queries-child-').pop()
                                if (!confirm(`Remove Query ${id}? U sure? LOL`)) { return; };
                                res = await backendRemoveQuery(id);
                            }
                            if (res instanceof Error) {
                                return;
                            } else {
                                li.remove();
                            };
                        });
                        const buttonQuery = document.createElement('button');
                        buttonQuery.className = "icon-button sql";
                        buttonQuery.addEventListener('click', async (ev) => {
                            ev.stopPropagation();
                            const li = ev.target.closest('li');
                            let id = li.querySelector('ul').id;
                            if (id.startsWith('ce-root-saved-queries-')) {
                                const sql = await dbGet('main', 'queries', id.replace('ce-root-saved-queries-child-', ''))
                                window.editor.setValue(
                                    `${sql.sql}\n\n`
                                    + window.editor.getValue().split('\n').map(line => `-- ${line}`).join('\n')
                                )
                                return;
                            }
                            const table = ev.target.closest('ul').id
                                .replace('ce-root-file-storage-public-url-child-', 'public_url.')
                                .replace('ce-root-file-storage-uploaded-child-', 'uploaded.')
                            window.editor.setValue(
                                `SELECT *\nFROM ${table}\n\n`
                                + window.editor.getValue().split('\n').map(line => `-- ${line}`).join('\n')
                            )
                        });
                        divBtn.appendChild(buttonQuery);
                        divBtn.appendChild(buttonRemove);
                    };
                    const ul = document.createElement('ul');
                    ul.id = id;
                    ul.className = `ce-closed`;
                    li.appendChild(ul);
                    ul.appendChild(div);
                    div.appendChild(divText);
                    div.appendChild(divBtn);
                    divText.appendChild(span);
                    catalog.append(li);
                    makeCatalogExplorer(ul)
                } else {
                    li.id = id;
                    li.appendChild(div);
                    div.appendChild(divText);
                    div.appendChild(divBtn);
                    divText.appendChild(span);
                    catalog.append(li);
                };
            });
        };
    };
    //catalog.getElementsByClassName('ce-more-btn')[0].addEventListener('click', (event) => {
    //    event.stopPropagation();
    //    console.log('dots clicked');
    //});
    console.log(catalog);
    catalog.querySelector('.ce-header').addEventListener('click', () => {
        console.log('click');
        toggleOpenClose(catalog);
    });
};
function initCatalogExplorer() {
    function prepPublicUrlModal() {
        const modal = document.getElementById('ce-root-file-storage-public-url-modal');
        const dialog = modal.querySelector('.modal-dialog');
        const idInput = document.getElementById('ce-root-file-storage-public-url-modal-id');
        const urlInput = document.getElementById('ce-root-file-storage-public-url-modal-url');
        const typeInput = document.getElementById('ce-root-file-storage-public-url-modal-type');
        const urlMsg = document.getElementById('ce-root-file-storage-public-url-modal-url-msg');
        modal.addEventListener("click", (ev) => {
            if (!dialog.contains(ev.target)) {
                modal.classList.remove("open");
            }
        });
        urlInput.addEventListener('input', (ev) => {
            const url = ev.target.value;
            const type = url.split('.').pop();
            urlMsg.textContent = null;
            if (!['csv', 'json', 'parquet'].includes(type)) {
                urlMsg.textContent = 'Currently, only .parquet, .csv and .json are allowed.'
                return;
            }
            typeInput.value = type;
            idInput.value = toSnakeCase(url.split('/').pop().split('.')[0]);
            //typeInput.parentNode.style.display = 'block';
            idInput.parentNode.style.display = 'block';
        });
        modal.querySelector('button').addEventListener('click', async (ev) => {
            const id = idInput.value;
            const url = urlInput.value;
            const type = typeInput.value;
            if (await dbGet('main', 'publicUrl', id.toLowerCase())) {
                if (!confirm(`Already exists a Public URL queriable as ${id.toLowerCase()}. Continuing will replace existing file.`)) { return; }
            };
            const res = await backendRegisterPublicUrl(id, url, type);
            console.log(res);
            if (res instanceof Error) {
                document.getElementById('ce-root-file-storage-public-url-modal-submit-msg').textContent = res;
            } else {
                modal.classList.remove("open");
                document.getElementById('ce-root-file-storage-public-url').querySelector('button.refresh').click();
            };
        });
    };
    function prepUploadedModal() {
        const modal = document.getElementById('ce-root-file-storage-uploaded-modal');
        const dialog = modal.querySelector('.modal-dialog');
        const idInput = document.getElementById('ce-root-file-storage-uploaded-modal-id');
        const fileInput = document.getElementById('ce-root-file-storage-uploaded-modal-file');
        const typeInput = document.getElementById('ce-root-file-storage-uploaded-modal-type');
        const fileMsg = document.getElementById('ce-root-file-storage-uploaded-modal-file-msg');
        fileInput.addEventListener('input', (ev) => {
            const file = ev.target.files[0];
            const type = file.name.split('.').pop();
            fileMsg.textContent = null;
            if (!['csv', 'json', 'parquet'].includes(type)) {
                fileMsg.textContent = 'Currently, only .parquet, .csv and .json are allowed.'
                return;
            }
            typeInput.value = type;
            idInput.value = toSnakeCase(file.name.split('/').pop().split('.')[0]);
            //typeInput.parentNode.style.display = 'block';
            idInput.parentNode.style.display = 'block';
        });
        modal.addEventListener("click", (ev) => {
            if (!dialog.contains(ev.target)) {
                modal.classList.remove("open");
            }
        });
        modal.querySelector('button').addEventListener('click', async (ev) => {
            const id = idInput.value;
            const file = fileInput.files[0];
            const type = typeInput.value;
            if (await dbGet('main', 'publicUrl', id.toLowerCase())) {
                if (!confirm(`Already exists a file queriable as ${id.toLowerCase()}. Continuing will replace existing file.`)) { return; }
            };
            const res = await backendRegisterUpload(id, file, type);
            console.log(res);
            if (res instanceof Error) {
                document.getElementById('ce-root-file-storage-uploaded-modal-submit-msg').textContent = res;
            } else {
                modal.classList.remove("open");
                document.getElementById('ce-root-file-storage-uploaded').querySelector('button.refresh').click();
            };
        });
    };
    prepPublicUrlModal();
    prepUploadedModal();
    const catalogTypes = Array.from(document.getElementsByClassName('ce-catalog'));
    catalogTypes.forEach(makeCatalogExplorer);
};
//#endregion

//#region Query Editor
function makeTable(tableId, tableData) {
    function jsonToTable(json) {
        const data = Array.isArray(json) ? json : [json];
        console.log(data);
        if (data.length === 0) return;
        const table = document.createElement("table");
        const colgroup = document.createElement("colgroup");
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");
        tbody.className = 'list';
        const trHead = document.createElement("tr");
        const cols = [];
        data.schema.forEach(({ col, type }) => {
            colgroup.appendChild(document.createElement("col"));
            const th = document.createElement("th");
            const div = document.createElement('div');
            const span = document.createElement('span');
            span.textContent = col;
            const button = document.createElement('button');
            button.className = 'sort icon-button';
            button.setAttribute('data-sort', col);
            div.appendChild(span);
            div.appendChild(button);
            th.appendChild(div);
            trHead.appendChild(th);
            cols.push(col);
        });
        thead.appendChild(trHead);
        data.forEach(row => {
            const tr = document.createElement("tr");
            data.schema.forEach(({ col, type }) => {
                const td = document.createElement("td");
                td.className = col;
                if (['TIMESTAMP', 'DATETIME', 'DATE', 'TIMESTAMP WITH TIME ZONE'].includes(type)) {
                    td.textContent = (new Date(row[col])).toISOString();
                } else {
                    td.textContent = row[col];
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.append(colgroup);
        table.appendChild(thead);
        table.appendChild(tbody);
        return [table, cols];
    };
    function makeColumnsResizable(table) {
        const cols = table.querySelectorAll("th");
        cols.forEach(th => {
            const handle = document.createElement("div");
            handle.className = "handle";
            th.appendChild(handle);

            let startX, startWidth;
            handle.addEventListener("mousedown", e => {
                startX = e.pageX;
                startWidth = th.offsetWidth;
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onStop);
                e.preventDefault();
            });
            function onMove(e) {
                const newWidth = startWidth + (e.pageX - startX);
                const table = th.closest('table');
                const index = Array.from(th.parentNode.childNodes).indexOf(th);
                const cols = table.querySelectorAll('col');
                if (cols[index]) {
                    cols[index].style.width = newWidth + "px";
                };
                let totalWidth = Array.from(cols).reduce((sum, col) => {
                    return sum + (parseFloat(col.style.width) || col.offsetWidth);
                }, 0);
                table.style.width = totalWidth + "px";
                e.preventDefault();
            };
            function onStop() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onStop);
            };
        });
    };
    function autoSizeTable(table) {
        const ths = table.querySelectorAll("th");
        const tbody = table.querySelector("tbody");
        const cols = table.querySelectorAll("col");
        let totalWidth = 0;
        ths.forEach((th, i) => {
            const thWidth = measureTextWidth(th.querySelector('span').textContent, th) + 20;
            const tds = Array.from(tbody.querySelectorAll(`tr td:nth-child(${i + 1})`)).slice(0, 10);
            const tdWidths = tds.map(td => measureTextWidth(td.textContent, td));
            const maxContentWidth = Math.max(thWidth, ...tdWidths) + 20;
            const colWidth = Math.min(maxContentWidth, 200);
            cols[i].style.width = colWidth + "px";
            totalWidth += colWidth;
        });
        table.style.width = totalWidth + "px";
    };
    function measureTextWidth(text, el) {
        const span = document.createElement("span");
        span.style.visibility = "hidden";
        span.style.position = "absolute";
        span.style.whiteSpace = "nowrap";
        const style = window.getComputedStyle(el);
        span.style.font = style.font;
        span.textContent = text;
        document.body.appendChild(span);
        const width = span.offsetWidth;
        document.body.removeChild(span);
        return width;
    };
    const div = document.getElementById(tableId);
    div.replaceChildren();
    const input = document.createElement('input');
    input.className = "search";
    input.placeholder = "Search";
    const ul = document.createElement('ul');
    ul.className = "pagination";
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'actions-wrapper';
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    const [table, cols] = jsonToTable(tableData);
    makeColumnsResizable(table);
    autoSizeTable(table);
    actionsWrapper.appendChild(input);
    actionsWrapper.appendChild(ul);
    div.appendChild(actionsWrapper);
    tableWrapper.appendChild(table);
    div.appendChild(tableWrapper);
    new List(tableId, { valueNames: cols }); //, page: 20, pagination: { innerWindow: 2, outerWindow: 2 } });
};
function makeQueryEditor(editor, queryResultOutput, runBtn, saveBtn, copyBtn, exportBtn) {
    function sameColumns(a, b) {
        if (a.length !== b.length) return false;
        const A = new Set(a);
        for (const col of b) if (!A.has(col)) return false;
        return true;
    };
    function updateActiveQuery(result) {
        const colChange = !activeQueryResults ? true : !sameColumns(result.columns, activeQueryResults.columns);
        activeQueryResults = result;
        activeQueryTarget.dispatchEvent(new CustomEvent('change'));
        colChange ? activeQueryTarget.dispatchEvent(new CustomEvent('col-change')) : null;
    };
    function getQuery() {
        const model = window.editor.getModel();
        const selection = window.editor.getSelection();

        // Return selected text if any
        if (!selection.isEmpty()) {
            return model.getValueInRange(selection).trim();
        }

        const sqlText = model.getValue();
        const position = window.editor.getPosition();
        const lines = sqlText.split('\n');

        // Determine cursor "effective" offset (start of line)
        const lineStartIndex = lines.slice(0, position.lineNumber - 1)
            .reduce((sum, l) => sum + l.length + 1, 0);
        let cursorIndex = lineStartIndex;

        // Track semicolons outside comments
        let semicolons = [];
        let inBlock = false;
        for (let i = 0; i < sqlText.length; i++) {
            if (!inBlock && sqlText.startsWith('/*', i)) {
                inBlock = true;
                i++;
                continue;
            }
            if (inBlock) {
                const end = sqlText.indexOf('*/', i);
                if (end === -1) break;
                i = end + 1;
                inBlock = false;
                continue;
            }
            if (sqlText.startsWith('--', i)) {
                const nextLine = sqlText.indexOf('\n', i);
                i = nextLine === -1 ? sqlText.length - 1 : nextLine;
                continue;
            }
            if (sqlText[i] === ';' && !inBlock) semicolons.push(i);
        }

        // Single query -> return everything
        if (semicolons.length === 0) return sqlText.trim();

        // Find the previous semicolon before the cursor
        let start = 0;
        for (let i = 0; i < semicolons.length; i++) {
            if (semicolons[i] < cursorIndex) start = semicolons[i] + 1;
        }

        // Determine end of the query
        let end = sqlText.length;
        for (let i = 0; i < semicolons.length; i++) {
            if (semicolons[i] >= cursorIndex) {
                // check if there's text after ; on the same line
                const lineEnd = sqlText.indexOf('\n', semicolons[i]);
                const lineText = sqlText.slice(semicolons[i] + 1, lineEnd === -1 ? sqlText.length : lineEnd);
                if (/^\s*$/.test(lineText)) {
                    end = semicolons[i]; // no text after ; -> end query here
                } else {
                    start = semicolons[i] + 1; // text after ; -> start of next query
                    end = semicolons[i + 1] ?? sqlText.length;
                }
                break;
            }
        }

        return sqlText.slice(start, end).trim();
    };
    async function updateTable() {
        let tabledata = await backendQueryEditorExecute(getQuery(), '_active');
        console.log(tabledata);
        if (!(tabledata instanceof Error)) {
            updateActiveQuery(tabledata)
            makeTable('query-results-output', tabledata);
        } else {
            let span = document.createElement('span')
            span.className = 'query-result-error';
            span.innerText = `${tabledata.name}: ${tabledata.message}`;
            queryResultOutput.replaceChildren(span);
        }
    };
    async function saveQuery() {
        const sql = getQuery();
        const name = prompt(`${''}Saving\n\n${sql}\n\nas:`);
        if (name) {
            const id = toSnakeCase(name);
            const res = await backendRegisterQuery(id, name, sql);
            if (res instanceof Error) {
                showAlert(res)
                return;
            }
            const ul = document.getElementById('ce-root-saved-queries');
            Array.from(ul.querySelectorAll(':scope > li')).forEach(el => el.remove());
            ul.classList.remove('ce-closed');
            ul.classList.remove('ce-open');
            ul.classList.add('ce-closed');
            ul.querySelector('.ce-header').click();
        };
    };
    async function activeQueryToClipboard() {
        let tabledata = await backendQueryEditorExecute('SELECT * FROM _active');
        const text = tabledata.columns.join('\t') + '\n' +
            tabledata.map(r => tabledata.columns.map(c => r[c]).join('\t')).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            showAlert('Table copied to clipboard!');
        } catch (err) {
            showAlert(err);
        }

    };
    async function activeQueryToFile() {
        let tabledata = await backendQueryEditorExecute('SELECT * FROM _active');
        const text = tabledata.columns.join('\t') + '\n' +
            tabledata.map(r => tabledata.columns.map(c => r[c]).join('\t')).join('\n');
        try {
            const blob = new Blob([text], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'table.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Release object URL
            URL.revokeObjectURL(url);
        } catch (err) {
            showAlert(err);
        }

    };
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, updateTable);
    runBtn.addEventListener('click', updateTable);
    saveBtn.addEventListener('click', saveQuery);
    copyBtn.addEventListener('click', activeQueryToClipboard);
    exportBtn.addEventListener('click', activeQueryToFile);
};
function initQueryEditor() {
    const queryResultOutput = document.getElementById('query-results-output');
    const runBtn = document.getElementById('qe-run-query-btn');
    const saveBtn = document.getElementById('qe-save-query-btn');
    const copyBtn = document.getElementById('qe-copy-query-btn');
    const exportBtn = document.getElementById('qe-export-query-btn');
    makeQueryEditor(window.editor, queryResultOutput, runBtn, saveBtn, copyBtn, exportBtn);
}
//#endregion

//#region Chart Editor
function makeChart(chartId, data, options = null, plugins = []) {
    const el = document.createElement('canvas');
    el.id = chartId;
    console.log(
        data, options
    )
    new Chart(el, {
        type: 'bar',
        data,
        options: {
            ...options,
            //parsing: false,
            //normalized: true,
            //responsive: true,
            //resizeDelay: 100,
            //maintainAspectRatio: false,
        },
        plugins: plugins,
    });
    return el;
};

function makeChartFromJson(targetEl, jsonInputVar) {
    const jsonInput = structuredClone(jsonInputVar);
    const formatters = {
            'hide0-maxDecimals2': (v) => v ? (new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)) : '',
        };
    function replaceFormatters(obj) {
        const formatters = {
            'hide0-maxDecimals2': (v) => v ? (new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)) : '',
        };
        obj.data.datasets.forEach(ds => {
            ds.datalabels.formatter = formatters[ds.datalabels.formatter];
        });
        return obj;
    };
    jsonInput.data.datasets.forEach(ds => {
        ds.datalabels.formatter = (v) => v ? (new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)) : '';
    });
    console.log('JSONNNN', jsonInput);
    const canvas = document.createElement('canvas');
    new Chart(canvas, jsonInput);
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    wrapper.appendChild(canvas);
    const header = document.createElement('div');
    header.className = 'chart-header';
    if (jsonInput.chartText.title) {
        const title = document.createElement('h3');
        title.textContent = jsonInput.chartText.title;
        header.appendChild(title);
    };
    if (jsonInput.chartText.subtitle) {
        const subtitle = document.createElement('span');
        subtitle.textContent = jsonInput.chartText.subtitle;
        header.appendChild(subtitle);
    };
    targetEl.replaceChildren();
    targetEl.appendChild(header);
    targetEl.appendChild(wrapper);
};

async function makeChartJson(dataJson, configJson) {
    if (!dataJson.yAxisColumns.length) { console.log('not enough data'); return; };
    let data;
    const dColsExpr = dataJson.xAxisColumns.map(c => `${c.expr} AS ${c.alias}`);
    const dCols = dataJson.xAxisColumns.map(c => c.alias);
    const gAgg = dataJson.groupBy;

    const jsonInput = structuredClone(configJson);
    jsonInput.data = {};
    jsonInput.data.datasets = [];

    if (dataJson.yAxisColumns.length == 1) {
        if (dataJson.yAxisColumns[0].columns.length == 1 && !dataJson.yAxisColumns[0].colorBy) {
            jsonInput ??= {};
            jsonInput.options ??= {};
            jsonInput.options.plugins ??= {};
            jsonInput.options.plugins.legend ??= {};
            jsonInput.options.plugins.legend.display = false;
        }
    };

    async function addData(yCols) {
        let gCol = yCols.colorBy.expr;
        gCol = gCol ? gCol + ' AS color_by' : gCol;
        const mCols = yCols.columns;
        const mExprs = mCols.map(x =>
            (gAgg ? x.agg.replace('_col_', x.expr.includes('(') ? x.expr : `"${x.expr}"`) : x.expr.includes('(') ? x.expr : `"${x.expr}"`) + ' AS ' + x.alias
        );
        const mAlias = mCols.map(x => x.alias);
        //const mTypes = mCols.map(x => yCols.columns.type ?? 'bar');

        let sql = `
                SELECT 
                    ${[...dColsExpr, gCol, mExprs].filter(v => v).join(', ')}
                FROM ${dataJson.chartDataSource}
                ${gAgg ? 'GROUP BY ALL' : ''}
            `
        if (gCol) {
            sql = `
                    WITH t AS (${sql})
                    SELECT *
                    `
            const pivots = mAlias.map((x, i) => `${i ? 'JOIN' : 'FROM'} ( PIVOT t ON color_by || '~~~' || '${x}' USING FIRST(${x}) ) ${i ? 'USING (' + dCols.join(', ') + ')' : ''}`)
            pivots.forEach(x => sql = sql + x)
        }
        data = await backendQueryEditorExecute(sql);

        jsonInput.data.labels = data.map(row => dCols.length > 1 ? dCols.map(c => row[c]) : row[dCols[0]] ?? '');
        const formatter = 'hide0-maxDecimals2';
        if (!gCol) {
            mCols.forEach((x, i) => {
                let datalabels;
                if (mCols.length == 1) {
                    datalabels = {
                        anchor: 'end',
                        align: 'top',
                        formatter: formatter,
                    }
                } else {
                    datalabels = x.type == 'line' ? { display: false } : {
                        anchor: 'center',
                        align: 'center',
                        formatter: formatter,
                    }
                };
                const dataset = {
                    label: x.display,
                    data: data.map(row => Number(row[x.alias])),
                    stack: x.stack,
                    type: x.type,
                    datalabels: datalabels,
                    pointStyle: x.type == 'line' ? 'circle' : 'rect',
                };
                jsonInput.data.datasets.push(dataset);
            });
        } else {
            mCols.forEach((x, i) => {
                console.log(x, i);
                data.columns.forEach(c => {
                    if (!c.includes('~~~')) { return; };
                    if (!(c.split('~~~').pop() === x.alias)) { return; };
                    let datalabels;
                    if (x.type == 'line') {
                        datalabels = {
                            display: false,
                        }
                    } else {
                        datalabels = {
                            anchor: 'center',
                            align: 'center',
                            formatter: formatter,
                        }
                    };
                    const dataset = {
                        label: c.split('~~~')[0],
                        data: data.map(row => Number(row[c])),
                        stack: x.stack,
                        type: x.type,
                        datalabels: datalabels,
                        pointStyle: x.type == 'line' ? 'circle' : 'rect',
                    };
                    jsonInput.data.datasets.push(dataset);
                });
            });
        };
    };
    await Promise.all(dataJson.yAxisColumns.map(yCols => addData(yCols)));
    jsonInput.chartText = dataJson.chartText;
    return jsonInput;
};

async function makeChartFromInput(targetEl, dataJson, configJson) {
    const jsonInput = await makeChartJson(dataJson, configJson);
    makeChartFromJson(targetEl, jsonInput);
};

function makeChartEditor(chartRender, chartForm) {
    let configJson = {
        type: 'bar',
        options: {
            scales: {
                x: {
                    type: 'category',
                }
            },
        }
    };
    let dataJson = {};
    Object.defineProperty(window, 'configJson', {
        get: () => configJson,
        configurable: true
    });
    Object.defineProperty(window, 'dataJson', {
        get: () => dataJson,
        configurable: true
    });
    Object.defineProperty(dataJson, 'chartType', {
        get: () => chartForm.querySelector('input[name="che-data-chart-type"]:checked').value,
        configurable: true
    });
    Object.defineProperty(dataJson, 'xAxisColumns', {
        get: () => Array.from(chartForm.querySelectorAll('#che-sortable-x-axis li div')).map(c => ({
            name: c.getAttribute('data-column-name'),
            expr: c.getAttribute('data-column-expr'),
            alias: c.getAttribute('data-column-alias'),
            display: c.getAttribute('data-column-display'),
        })),
        configurable: true
    });
    Object.defineProperty(dataJson, 'groupBy', {
        get: () => chartForm.querySelector('#che-sortable-group-by').classList.contains('active'),
        configurable: true
    });
    Object.defineProperty(dataJson, 'yAxisColumns', {
        get: () => Array.from(chartForm.querySelectorAll('#che-sortable-y-axis > li:has(ul.che-sortable-y-axis-stack li.sortable-item-column)')).map((s, i) => ({
            columns: Array.from(s.querySelectorAll('.che-sortable-y-axis-stack li div')).map(c => ({
                name: c.getAttribute('data-column-name'),
                expr: c.getAttribute('data-column-expr'),
                agg: c.getAttribute('data-column-agg'),
                alias: c.getAttribute('data-column-alias'),
                display: c.getAttribute('data-column-display'),
                type: c.getAttribute('data-column-type'),
                fill: c.getAttribute('data-column-fill'),
                color: c.getAttribute('data-column-color'),
                stack: `${c.getAttribute('data-column-type')}_${i}`,
            })),
            colorBy: {
                name: s.querySelector('.che-sortable-y-axis-stack-color-by li div')?.getAttribute('data-column-name'),
                expr: s.querySelector('.che-sortable-y-axis-stack-color-by li div')?.getAttribute('data-column-expr'),
                alias: s.querySelector('.che-sortable-y-axis-stack-color-by li div')?.getAttribute('data-column-alias'),
                display: s.querySelector('.che-sortable-y-axis-stack-color-by li div')?.getAttribute('data-column-display'),
            }
        })),
        configurable: true
    });
    Object.defineProperty(dataJson, 'chartText', {
        get: () => {
            const title = titleInput.value;
            const subtitle = subtitleInput.value;
            return { title: title, subtitle: subtitle };
        },
        configurable: true
    });
    Object.defineProperty(dataJson, 'chartDataSource', {
        get: () => dataSource.value,
        configurable: true
    });

    let columnSortableList;
    const dataSourceType = document.getElementById('che-data-source-type');
    const dataSource = document.getElementById('che-data-source');
    const columnList = document.getElementById('che-sortable-column-list');
    const xAxisList = document.getElementById('che-sortable-x-axis');
    const y0StackList = chartForm.getElementsByClassName('che-sortable-y-axis-stack')?.[0];
    const y0StackColorBy = chartForm.getElementsByClassName('che-sortable-y-axis-stack-color-by')?.[0];
    const colEditModal = document.getElementById('che-sortable-col-edit-modal');
    const colEditDialog = colEditModal.querySelector('.modal-dialog');
    const chartListModal = document.querySelector('.che-chart-list-modal');
    const chartListDialog = chartListModal.querySelector('.modal-dialog');
    const addStackBtn = document.getElementById('che-sortable-metrics-add-stack-btn');
    const titleInput = document.getElementById('che-data-chart-title');
    const subtitleInput = document.getElementById('che-data-chart-subtitle');
    const openChartBtn = document.getElementById('che-open-chart-btn');
    const saveChartBtn = document.getElementById('che-save-chart-btn');
    const runChartBtn = document.getElementById('che-run-chart-btn');
    const copyChartBtn = document.getElementById('che-copy-chart-btn');
    const exportChartBtn = document.getElementById('che-export-chart-btn');

    async function populateFormFromDataJson(dataJson) {
        console.log(dataJson);
        // 1. chartType
        if (dataJson.chartType) {
            const input = chartForm.querySelector(
                `input[name="che-data-chart-type"][value="${dataJson.chartType}"]`
            );
            if (input) input.checked = true;
        }
        // 3. groupBy
        if (dataJson.groupBy) chartForm.querySelector('#che-sortable-group-by').classList.add('active');
            else chartForm.querySelector('#che-sortable-group-by').classList.remove('active');
        // 5. chartText (title + subtitle)
        titleInput.value = dataJson.chartText.title ?? '';
        subtitleInput.value = dataJson.chartText.subtitle ?? '';
        // 6. chartDataSource
        dataSourceType.querySelector(`input[value='${(dataJson.chartDataSource.split('.')[0] == 'q') ? 'saved-query' : 'table'}']`).click();
        function waitForOption(selectEl, value) {
            return new Promise(resolve => {
                const check = () => {
                    const opt = selectEl.querySelector(`option[value="${value}"]`);
                    if (opt) resolve(opt);
                    else requestAnimationFrame(check);
                };
                check();
            });
        }
        await waitForOption(dataSource, dataJson.chartDataSource)
        dataSource.value = dataJson.chartDataSource;
        await setDataOptions(dataJson.chartDataSource);
        function waitForColumns(columnList) {
            return new Promise(resolve => {
                const check = () => {
                    const opt = columnList.querySelector(`li`);
                    if (opt) resolve(opt);
                    else requestAnimationFrame(check);
                };
                check();
            });
        };
        await waitForColumns(columnList)
        console.log('loaded');
        // 4. yAxisColumns
        const yAxisLen = dataJson.yAxisColumns.length;
        let yAxisStackToAdd = yAxisLen;
        Array.from(document.getElementById('che-sortable-y-axis').querySelectorAll(':scope > li')).forEach((li, i) => {
            if (i>=yAxisLen) { li.remove() }
            else {yAxisStackToAdd--}
        });
        while (yAxisStackToAdd>0) {
            addStackBtn.click();
            yAxisStackToAdd--;
        };
        console.log(dataJson.yAxisColumns);
        dataJson.yAxisColumns.forEach(({colorBy, columns}, i) => {
            if (colorBy.name) {
                console.log(colorBy.name);
                const item = columnSortableList.querySelector(`li div[data-column-name="${colorBy.name}"]`).closest('li').cloneNode(true);
                const div = item.querySelector('div');
                div.setAttribute('data-column-name', colorBy.name);
                div.setAttribute('data-column-expr', colorBy.expr);
                div.setAttribute('data-column-agg', colorBy.agg);
                div.setAttribute('data-column-alias', colorBy.alias);
                div.setAttribute('data-column-display', colorBy.display);
                if (colorBy.type) div.setAttribute('data-column-type', colorBy.type);
                if (colorBy.fill) div.setAttribute('data-column-fill', colorBy.fill);
                if (colorBy.color) div.setAttribute('data-column-color', colorBy.color);
                div.querySelector('span').textContent = colorBy.display;
                chartForm.getElementsByClassName('che-sortable-y-axis-stack-color-by')[i].appendChild(item);
            }
            columns.forEach(c => {
                const item = columnSortableList.querySelector(`li div[data-column-name="${c.name}"]`).closest('li').cloneNode(true);
                const div = item.querySelector('div');
                div.setAttribute('data-column-name', c.name);
                div.setAttribute('data-column-expr', c.expr);
                div.setAttribute('data-column-agg', c.agg);
                div.setAttribute('data-column-alias', c.alias);
                div.setAttribute('data-column-display', c.display);
                if (c.type) div.setAttribute('data-column-type', c.type);
                if (c.fill) div.setAttribute('data-column-fill', c.fill);
                if (c.color) div.setAttribute('data-column-color', c.color);
                div.querySelector('span').textContent = c.display;
                chartForm.getElementsByClassName('che-sortable-y-axis-stack')[i].appendChild(item);
            });
        });
        // 2. xAxisColumns
        xAxisList.replaceChildren();
        dataJson.xAxisColumns.forEach(col => {
            const item = columnSortableList.querySelector(`li div[data-column-name="${col.name}"]`).closest('li').cloneNode(true);
            const div = item.querySelector('div');
            div.setAttribute('data-column-name', col.name);
            div.setAttribute('data-column-expr', col.expr);
            div.setAttribute('data-column-alias', col.alias);
            div.setAttribute('data-column-display', col.display);
            div.querySelector('span').textContent = col.display;
            xAxisList.appendChild(item);
        });

        generateChart();
    };

    [titleInput, subtitleInput].forEach(el => el.addEventListener('change', (ev) => generateChart()));

    function removeOthers(item, to) {
        const n = Array.from(to.querySelectorAll('li')).length;
        let toRemove = n - 1;
        //if (from.getAttribute('data-sortable-limit-id') == to.id) {return;}
        while (toRemove > 0) {
            const rmEl = to.querySelector('li');
            if (rmEl === item) {
                rmEl.nextElementSibling?.remove()
                console.log('removed sibling');
            } else {
                rmEl.remove();
                console.log('removed self');
            };
            toRemove--;
        };
    };
    function makeSortableStack(stackList, stackColorBy) {
        const sortableStackList = new Sortable(stackList, {
            group: 'cols',
            onEnd: ({ item, from, oldIndex, newIndex, to, originalEvent: { clientX, clientY } }) => {
                if (from != to) {
                    //if (item.querySelector('div').getAttribute('data-column-name')!='_expr_') {
                    //    item.querySelector('span').textContent = item.querySelector('div').getAttribute('data-column-alias');
                    //};
                    generateChart();
                    return;
                }
                const rect = from.getBoundingClientRect();
                if (!(clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)) {
                    item.remove();
                    generateChart();
                    console.log('removed by drop');
                } else if (oldIndex != newIndex) {
                    generateChart();
                }
            },
            onAdd: ({ item, to }) => {
                //if (dataJson.groupBy) {
                //if (!item.querySelector('div').getAttribute('data-column-agg')) {
                //    item.querySelector('div').setAttribute('data-column-agg', 'COUNT( _col_ )')
                //};
                //if (item.querySelector('div').getAttribute('data-column-name')!='_expr_') {
                //    item.querySelector('span').textContent = item.querySelector('div').getAttribute('data-column-alias') + '\n' +
                //    item.querySelector('div').getAttribute('data-column-agg').replace(
                //        '_col_',
                //        item.querySelector('div').getAttribute('data-column-name')
                //    );
                //};
                //} else {
                //    item.querySelector('span').textContent = item.querySelector('div').getAttribute('data-column-alias')
                //}
                if (stackColorBy.querySelector('li')) { removeOthers(item, to) };
            }
        });
        const sortableStackColorBy = new Sortable(stackColorBy, {
            group: 'cols',
            onEnd: ({ item, from, to, originalEvent: { clientX, clientY } }) => {
                if (from != to) {
                    stackList.classList.remove('sortable-one');
                    generateChart();
                    return;
                };
                const rect = from.getBoundingClientRect();
                if (!(clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)) {
                    item.remove(); console.log('removed by drop');
                    stackList.classList.remove('sortable-one');
                    generateChart();
                    return;
                }
            },
            onAdd: ({ to, from, item, oldIndex }) => {
                const n = Array.from(to.querySelectorAll('li')).length;
                if (n > 1) {
                    removeOthers(item, to);
                    console.log('removed', item, 'from', to);
                } else if (Array.from(stackList.querySelectorAll('li')).length > 1) {
                    console.log('stacklist has items');
                    const confirmation = confirm(`Adding a "Color By" doesn't allow multiple metrics in "Stack". Would you like to continue?`)
                    console.log('requested confirmation');
                    if (!confirmation) {
                        console.log('confirmation denied');
                        if (from != columnSortableList) {
                            from.insertBefore(item, from.children[oldIndex] || null)
                        } else {
                            item.remove();
                        };
                        return;
                    };
                    console.log('confirmation given');
                    removeOthers(stackList.querySelector('li'), stackList);
                    console.log('removed others from stacklist');
                }
                stackList.classList.add('sortable-one');
                return;
            },
        });
        const btnGroup = stackList.querySelector('.btn-group');
        btnGroup.querySelector('.remove').addEventListener('click', (ev) => {
            if (Array.from(ev.target.closest('li').closest('ul').querySelectorAll('li')).length > 1) {
                ev.target.closest('li').remove();
                generateChart();
            }
        });
        btnGroup.querySelector('.move-up').addEventListener('click', (ev) => {
            const li = ev.target.closest('li');
            console.log('move-up', li);
            if (li.previousElementSibling.tagName.toLowerCase() === 'li') {
                li.previousElementSibling.before(li);
                generateChart();
            };
        });
        btnGroup.querySelector('.move-down').addEventListener('click', (ev) => {
            const li = ev.target.closest('li');
            console.log('move-down', li);
            if (li.nextElementSibling.tagName.toLowerCase() === 'li') {
                li.nextElementSibling.after(li);
                generateChart();
            };
        });
    };
    function makeSortable() {
        new Sortable(xAxisList, {
            group: 'cols',
            onEnd: ({ item, from, to, oldIndex, newIndex, originalEvent: { clientX, clientY } }) => {
                if (from != to) {
                    generateChart();
                    return;
                }
                const rect = from.getBoundingClientRect();
                if (!(clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom)) {
                    item.remove();
                    generateChart();
                    console.log('removed by drop');
                } else if (oldIndex != newIndex) {
                    generateChart();
                }
            },
        });
        makeSortableStack(y0StackList, y0StackColorBy);
    };
    //function makeCustomExpressionOption() {
    //    const li = document.createElement('li');
    //    li.className = "sortable-item-column blank-expression";
    //    const div = document.createElement('div');
    //    const input = document.createElement('span');
    //    const button = document.createElement('button');
    //    button.className = 'config icon-button';
    //    input.innerText = 'Custom Expression';
    //    div.className = 'expression';
    //    div.setAttribute('data-column-name', '_expr_');
    //    div.setAttribute('data-column-expr', '_expr_');
    //    div.setAttribute('data-column-alias', '_expr_');
    //    div.setAttribute('data-column-agg', '_col_');
    //    div.setAttribute('data-column-data-type', 'expr');
    //    div.appendChild(input);
    //    div.appendChild(button);
    //    li.appendChild(div);
    //    return li;
    //};
    //function makeCountExpressionOption() {
    //    const li = document.createElement('li');
    //    li.className = "sortable-item-column";
    //    const div = document.createElement('div');
    //    const span = document.createElement('span');
    //    const button = document.createElement('button');
    //    button.className = 'config icon-button';
    //    span.innerText = 'Row Count';
    //    div.className = 'expression';
    //    div.setAttribute('data-column-name', '_expr_');
    //    div.setAttribute('data-column-expr', 'COUNT(*)');
    //    div.setAttribute('data-column-agg', '_col_');
    //    div.setAttribute('data-column-alias', 'row_count');
    //    div.setAttribute('data-column-data-type', 'integer');
    //    div.appendChild(span);
    //    div.appendChild(button);
    //    li.appendChild(div);
    //    return li;
    //};
    function prepModal() {
        colEditModal.addEventListener("click", e => {
            if (!colEditDialog.contains(e.target)) {
                colEditModal.classList.remove("open");
            }
        });
        chartListDialog.querySelector('button.refresh').addEventListener('click', (ev) => refreshChartList(chartListDialog.querySelector('ul')));
        chartListModal.addEventListener("click", e => {
            if (!chartListDialog.contains(e.target)) {
                chartListModal.classList.remove("open");
            }
        });
        Array.from(colEditModal.querySelectorAll('input,select')).forEach((el) => el.addEventListener('change', (ev) => {
            const colDiv = colEditModal.currentButton?.closest('div');
            const tgtData = ev.target.getAttribute('data-tgt-data');
            console.log(colDiv);
            colDiv.setAttribute(tgtData, ev.target.value);
            if (tgtData === 'data-column-display') {
                colDiv.querySelector('span').textContent = ev.target.value;
            };
            generateChart();
        }));
    };
    function makeModalBtn(btn) {
        btn.addEventListener('click', (ev) => {
            const colDiv = ev.target.closest('div');
            let colDivOption = colDiv.getAttribute('data-modal-options');
            const colUl = colDiv.closest('ul');
            if (colUl.id == 'che-sortable-x-axis') {
                colDivOption = colDivOption.replace('type,', '');
                colDivOption = colDivOption.replace('fill,', '');
                colDivOption = colDivOption.replace('border,', '');
                colDivOption = colDivOption.replace('agg,', '');
            };
            colDivOption = colDivOption?.split(',');
            colDivOption.pop();
            const rect = ev.target.getBoundingClientRect();
            const x = rect.right;
            const y = rect.top;
            colEditDialog.style.left = x + "px";
            colEditDialog.style.top = y + "px";
            colEditModal.currentButton = ev.target;
            Array.from(colEditModal.querySelectorAll('input,select')).forEach((el) => {
                const elTgt = el.getAttribute('data-tgt-data');
                el.value = colDiv.getAttribute(elTgt);
                if (colDivOption.includes(elTgt.split('-').pop())) {
                    el.parentNode.style.display = "flex";
                } else {
                    el.parentNode.style.display = "none";
                }
            });
            colEditModal.classList.add("open");
        });
    };
    function makeColumnOption({ liClassName, spanInnerText, divClassName, dataColName, dataColExpr, dataColAgg, dataColAlias, dataColDisplay, dataColDT, dataModalOptions } = {}) {
        const li = document.createElement('li');
        li.className = liClassName ?? "sortable-item-column"; //blank-expression
        const div = document.createElement('div');
        const span = document.createElement('span');
        const button = document.createElement('button');
        button.className = 'config icon-button';
        span.innerText = spanInnerText; // 'Row Count'; 'Custom Expression'; col.column_name;
        div.className = divClassName; // 'expression'; col.data_type.toLowerCase().split('(')[0];
        div.setAttribute('data-column-name', dataColName);
        div.setAttribute('data-column-expr', dataColExpr);
        div.setAttribute('data-column-agg', dataColAgg);
        div.setAttribute('data-column-alias', dataColAlias);
        div.setAttribute('data-column-display', dataColDisplay);
        div.setAttribute('data-column-data-type', dataColDT);
        div.setAttribute('data-modal-options', dataModalOptions);
        div.appendChild(span);
        div.appendChild(button);
        li.appendChild(div);
        makeModalBtn(button)
        return li;
    }
    async function setDataOptions(tableOrQuery = null) {
        const cols = await backendFetchColumns(tableOrQuery);
        if (cols instanceof Error) { console.log(cols); return; };
        columnSortableList = document.createElement('ul');
        columnSortableList.className = 'sortable sortable-items-wrapper';
        let curDataType;
        cols.forEach(col => {
            const li = makeColumnOption({
                liClassName: "sortable-item-column",
                spanInnerText: col.column_name,
                divClassName: col.data_type.toLowerCase().split('(')[0],
                dataColName: col.column_name,
                dataColExpr: col.column_name,
                dataColAgg: 'COUNT(_col_)',
                dataColAlias: col.column_name,
                dataColDisplay: col.column_name,
                dataColDT: col.data_type,
                dataModalOptions: "display,agg,type,fill,border,",
            });
            if (col.data_type != (curDataType ?? col.data_type)) {
                // columnSortableList.appendChild(document.createElement('hr'));
            };
            curDataType = col.data_type;
            columnSortableList.appendChild(li);
        });
        columnSortableList.appendChild(makeColumnOption({
            liClassName: "sortable-item-column preset",
            spanInnerText: 'Row Count',
            divClassName: 'bigint',
            dataColName: 'row_count',
            dataColExpr: 'COUNT(*)',
            dataColAgg: '_col_',
            dataColAlias: '__expr_row_count__',
            dataColDisplay: 'Row Count',
            dataColDT: 'BIGINT',
            dataModalOptions: "display,type,fill,border,",
        }));
        columnSortableList.appendChild(makeColumnOption({
            liClassName: "sortable-item-column blank-expression",
            spanInnerText: 'Expression (Drag and set)',
            divClassName: 'expression',
            dataColName: '_expr_',
            dataColExpr: '',
            dataColAgg: '_col_',
            dataColAlias: '_expr_',
            dataColDisplay: 'Expression',
            dataColDT: '_expr_',
            dataModalOptions: "display,expr,agg,type,fill,border,",
        }));
        new Sortable(columnSortableList, {
            group: { name: 'cols', put: false, pull: 'clone' },
            sort: false,
            onEnd: ({ item, clone, from, to }) => {
                if (from != to) {
                    const itemId = generateId(4)
                    item.querySelector('div').setAttribute('data-column-alias', `${toSnakeCase(item.querySelector('div').getAttribute('data-column-name'))}_${itemId}`);
                    makeModalBtn(clone.querySelector('button.config'));
                    generateChart();
                }
            },
        });
        columnList.querySelector('ul')?.remove();
        columnList.appendChild(columnSortableList);
        const cols_name = cols.map(col => col.column_name);
        Array.from(document.querySelectorAll('.sortable-target-cols .sortable-item-column')).forEach(li => {
            if (!cols_name.includes(li.querySelector('div').getAttribute('data-column-name'))) { li.remove() }
        });

    };
    //function updateJson(el, jsonVar) {
    //    let val = null;
    //    //console.log(el.id, el.type, el.tagName.toLowerCase());
    //    if (el.tagName.toLowerCase() === 'select') {
    //        val = el.value;
    //    } else if (el.type === 'checkbox') {
    //        val = el.checked;
    //    } else if (el.type === 'radio') {
    //        if (!el.checked) {return;};
    //        val = el.value === "True" ? true : el.value === "False" ? false : null;
    //    } else {
    //        val = el.value;
    //    }
    //    const isDefault =
    //        val === '' ||
    //        val === '#000000' ||
    //        val === undefined ||
    //        val === null;
    //
    //    //console.log(val);
    //    const path = el.getAttribute('data-path').split('.');
    //    let cur = jsonVar;
    //    let parents = []; // stack to allow cleanup
    //    let keys = [];
    //    for (let i = 0; i < path.length; i++) {
    //        let p = path[i];
    //        parents.push(cur);
    //        keys.push(p);
    //
    //        const m = p.match(/(.+)\[(\d+)\]$/);
    //        if (m) {
    //            const arrName = m[1];
    //            const idx = parseInt(m[2], 10);
    //
    //            if (!(arrName in cur)) cur[arrName] = [];
    //            while (cur[arrName].length <= idx) cur[arrName].push({});
    //
    //            if (i === path.length - 1) {
    //                if (isDefault) {
    //                    delete cur[arrName][idx];
    //                } else {
    //                    cur[arrName][idx] = val;
    //                }
    //            } else {
    //                if (typeof cur[arrName][idx] !== 'object') {
    //                    cur[arrName][idx] = {};
    //                }
    //                cur = cur[arrName][idx];
    //            }
    //        } else {
    //            if (i === path.length - 1) {
    //                if (isDefault) {
    //                    delete cur[p];
    //                } else {
    //                    cur[p] = val;
    //                }
    //            } else {
    //                if (!(p in cur)) cur[p] = {};
    //                cur = cur[p];
    //            }
    //        }
    //    };
    //};
    //function resetJson(jsonVar, elArray) {
    //    for (const key in jsonVar) delete jsonVar[key];
    //    elArray.forEach(el => updateJson(el, jsonVar));
    //};
    function addStack(btn) {
        console.log('click');
        const stack = btn.previousElementSibling
        const newStackIter = stack.cloneNode(true);
        Array.from(newStackIter.querySelectorAll('li.sortable-item-column')).forEach(el => el.remove());
        btn.before(newStackIter);
        makeSortableStack(
            newStackIter.getElementsByClassName('che-sortable-y-axis-stack')?.[0],
            newStackIter.getElementsByClassName('che-sortable-y-axis-stack-color-by')?.[0]
        );
        //const delBtn = document.createElement('button');
        //delBtn.id = btn.id.replace('-add-', '-del-');
        //delBtn.className = btn.className.replace('-add-', '-del-');
        //delBtn.innerText = 'Remove';
        //delBtn.addEventListener('click', (ev) => removeStack(ev.target));
        //newStackIter.appendChild(delBtn);
        //setGroupOrder(group);
        //Array.from(newGroupIter.querySelectorAll('[id^="che-data-"]')).forEach(el => {
        //    el.addEventListener('change', (ev) => {
        //        updateChartEditorJson(ev.target, dataJson);
        //        generateJsonFromChartEditor();
        //    });
        //});
    };
    async function generateChart() {
        await makeChartFromInput(chartRender, dataJson, configJson);
    };
    function copyChart() {
        html2canvas(document.getElementById('chart-render'), { scale: 2 }).then(canvas => {
            canvas.toBlob(async blob => {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ])
            })
        })
    };
    function exportChart() {
        html2canvas(document.getElementById('chart-render'), { scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'chart.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    };
    async function saveChart() {
        const jsonInput = await makeChartJson(dataJson, configJson);
        const name = prompt('Save chart as:')
        const id = toSnakeCase(name);
        const loadedDataJson = {
            chartType: dataJson.chartType,
            xAxisColumns: dataJson.xAxisColumns,
            groupBy: dataJson.groupBy,
            yAxisColumns: dataJson.yAxisColumns,
            chartText: dataJson.chartText,
            chartDataSource: dataJson.chartDataSource,
        };
        backendRegisterChart(id, name, loadedDataJson, configJson, jsonInput);
    };
    function dataSourceOnChange() {
        const ds = dataSource.value;
        console.log(ds);
        try {
            activeQueryTarget.removeEventListener('col-change', (ev) => setDataOptions());
        } catch (err) { console.log(err) };
        if (ds == '_active') {
            activeQueryTarget.addEventListener('col-change', (ev) => setDataOptions());
            setDataOptions();
        } else {
            setDataOptions(ds);
        };
    };
    async function dataSourceTypeOnChange() {
        const dsType = dataSourceType.querySelector('input:checked').value;
        console.log(dsType);
        if (dsType === 'query-editor') {
            const opts = [{ name: 'Active Tab', value: '_active' }].map(({ name, value }) => {
                const opt = document.createElement('option');
                opt.textContent = name;
                opt.value = value;
                return opt;
            });
            dataSource.replaceChildren(...opts);
        } else if (dsType === 'saved-query') {
            const queries = await backendListQueries();
            const opts = queries.map(({ name, value }) => {
                const opt = document.createElement('option');
                opt.textContent = name;
                opt.value = value;
                return opt;
            });
            dataSource.replaceChildren(...opts);
        } else if (dsType === 'table') {
            const tables = await backendListTables();
            const groupOpts = tables.map(({ group, opts }) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = group.key;
                opts.forEach(({ name, value }) => {
                    const opt = document.createElement('option');
                    opt.label = name;
                    opt.value = value;
                    optgroup.appendChild(opt);
                });
                return optgroup;
            });
            dataSource.replaceChildren(...groupOpts);
        };
        dataSourceOnChange();
    };
    async function refreshChartList(ul) {
        const chartList = await backendListCharts();
        const liList = [0];
        if (chartList instanceof Error) {
            showAlert(chartList);
        } else {
            Array.from(ul.querySelectorAll('li')).forEach(c => c.remove());
            chartList.forEach(({ name, id }) => {
                const li = document.createElement('li');
                li.setAttribute('data-chart-id', id);
                const span = document.createElement('span');
                span.textContent = name;
                const div = document.createElement('div');
                div.className = 'btn-group';
                const editBtn = document.createElement('button');
                editBtn.className = 'icon-button edit';
                const removeBtn = document.createElement('button');
                removeBtn.className = 'icon-button remove';
                div.appendChild(editBtn);
                div.appendChild(removeBtn);
                li.appendChild(span);
                li.appendChild(div);
                ul.appendChild(li);
                removeBtn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    if (confirm(`Deleting ${name} [${id}] ? It's you call...`)) {
                        await backendRemoveChart(id);
                        li.remove();
                    };
                    //ev.stopPropagation();
                    //ev.preventDefault();
                });
                editBtn.addEventListener('click', async (ev) => {
                    if (confirm(`This will replace current chart editor options. Sorry, tabs not implemented yet.`)) {
                        const chart = await dbGet('main', 'charts', id);
                        populateFormFromDataJson(chart.dataJson);
                        configJson = chart.configJson;
                    };
                    //ev.stopPropagation();
                    //ev.preventDefault();
                });
            });
        };
    };
    async function chartListModalClick(ev) {
        const ul = chartListModal.querySelector('ul');
        if (!ul.querySelector('li')) {
            console.log('refreshing');
            await refreshChartList(ul)
        };
        const rect = ev.target.getBoundingClientRect();
        const x = rect.right;
        const y = rect.top;
        chartListDialog.style.left = x - 200 + "px";
        chartListDialog.style.top = y + 20 + "px";
        chartListModal.classList.toggle('open');
    };

    makeSortable();
    prepModal();
    dataSourceTypeOnChange();
    addStackBtn.addEventListener('click', (ev) => addStack(ev.target));
    runChartBtn.addEventListener('click', generateChart);
    saveChartBtn.addEventListener('click', saveChart);
    copyChartBtn.addEventListener('click', copyChart);
    exportChartBtn.addEventListener('click', exportChart);

    dataSourceType.addEventListener('change', dataSourceTypeOnChange);
    dataSource.addEventListener('change', dataSourceOnChange);
    openChartBtn.addEventListener('click', chartListModalClick);
    //function makeSortable(el) {
    //    const sortableJson = JSON.parse(el.getAttribute('data-sortable'));
    //    const max = el.getAttribute('data-sortable-max');
    //    const elOtherLimited = document.getElementById(el.getAttribute("data-sortable-limit-id"));
    //    if (el.classList.contains('sortable-target-cols')) {
    //        sortableJson.onEnd = ({ item, from, to, originalEvent: { clientX, clientY } }) => {
    //            if (elOtherLimited) {
    //                console.log(from.querySelector('li'));
    //                if (!from.querySelector('li')) {
    //                    elOtherLimited.removeAttribute('data-sortable-max');
    //                    elOtherLimited.classList.remove('sortable-one');
    //                    makeSortable(elOtherLimited);
    //                };
    //            };
    //            const dropTarget = document.elementFromPoint(clientX, clientY);
    //            const targetSortable = dropTarget?.closest('#chart-editor .sortable.sortable-target-cols');
    //            if (!targetSortable && from===to) {item.remove(); console.log('removed by drop'); return;};
    //        }
    //    }
    //    if (max) {
    //        sortableJson.onAdd = ({to, from, item}) => {
    //            const n = Array.from(to.querySelectorAll('li')).length;
    //            console.log(to, item, n, max);
    //            if (elOtherLimited) {
    //                Array.from(elOtherLimited.querySelectorAll('li')).forEach((li, i) => {if (i) {li.remove()}});
    //                elOtherLimited.setAttribute('data-sortable-max', 1);
    //                elOtherLimited.classList.add('sortable-one');
    //                makeSortable(elOtherLimited);
    //            };
    //            if (n > max) {
    //                let toRemove = n - max;
    //                if (from.getAttribute('data-sortable-limit-id') == to.id) {return;}
    //                console.log(toRemove);
    //                while (toRemove > 0) {
    //                    const rmEl = to.querySelector('li');
    //                    console.log(toRemove);
    //                    console.log(rmEl, item, rmEl===item);
    //                    if (rmEl === item) {
    //                        rmEl.nextElementSibling?.remove()
    //                        console.log('removed sibling');
    //                    } else {
    //                        rmEl.remove();
    //                            console.log('removed self');
    //                    };
    //                    toRemove--;
    //                    console.log(toRemove);
    //                }
    //                return;
    //            };
    //        }
    //    }
    //    new Sortable(el, {
    //        ...sortableJson,
    //    });
    //};
    //function setGroupOrder(group) {
    //    group.childNodes.forEach( (x, i) => {
    //        x.querySelectorAll('label').forEach(label => {
    //            label.for = label.setAttribute('for', label.getAttribute('for').replace(/\d+/, i));
    //        });
    //        x.querySelectorAll('select, input').forEach(input => {
    //            input.id = input.id.replace(/\d+/, i);
    //            input.setAttribute('data-path', input.getAttribute('data-path').replace(/\d+/, i)); 
    //        });
    //    });
    //};
    //function makeSortable(el) {
    //    const sortableJson = JSON.parse(el.getAttribute('data-sortable'));
    //    const max = el.getAttribute('data-sortable-max');
    //    const elOtherLimited = document.getElementById(el.getAttribute("data-sortable-limit-id"));
    //    if (el.classList.contains('sortable-target-cols')) {
    //        sortableJson.onEnd = ({ item, from, to, originalEvent: { clientX, clientY } }) => {
    //            if (elOtherLimited) {
    //                console.log(from.querySelector('li'));
    //                if (!from.querySelector('li')) {
    //                    elOtherLimited.removeAttribute('data-sortable-max');
    //                    elOtherLimited.classList.remove('sortable-one');
    //                    makeSortable(elOtherLimited);
    //                };
    //            };
    //            const dropTarget = document.elementFromPoint(clientX, clientY);
    //            const targetSortable = dropTarget?.closest('#chart-editor .sortable.sortable-target-cols');
    //            if (!targetSortable && from===to) {item.remove(); console.log('removed by drop'); return;};
    //        }
    //    }
    //    if (max) {
    //        sortableJson.onAdd = ({to, from, item}) => {
    //            const n = Array.from(to.querySelectorAll('li')).length;
    //            console.log(to, item, n, max);
    //            if (elOtherLimited) {
    //                Array.from(elOtherLimited.querySelectorAll('li')).forEach((li, i) => {if (i) {li.remove()}});
    //                elOtherLimited.setAttribute('data-sortable-max', 1);
    //                elOtherLimited.classList.add('sortable-one');
    //                makeSortable(elOtherLimited);
    //            };
    //            if (n > max) {
    //                let toRemove = n - max;
    //                if (from.getAttribute('data-sortable-limit-id') == to.id) {return;}
    //                console.log(toRemove);
    //                while (toRemove > 0) {
    //                    const rmEl = to.querySelector('li');
    //                    console.log(toRemove);
    //                    console.log(rmEl, item, rmEl===item);
    //                    if (rmEl === item) {
    //                        rmEl.nextElementSibling?.remove()
    //                        console.log('removed sibling');
    //                    } else {
    //                        rmEl.remove();
    //                            console.log('removed self');
    //                    };
    //                    toRemove--;
    //                    console.log(toRemove);
    //                }
    //                return;
    //            };
    //        }
    //    }
    //    new Sortable(el, {
    //        ...sortableJson,
    //    });
    //};

    //async function updateChart() {
    //    let tabledata = await backendQueryEditorExecute(window.editor.getValue())
    //    console.log(tabledata);
    //    if (!(tabledata instanceof Error)) {
    //        let canvas = makeChart(
    //            'che-chart-sample',
    //            {
    //                labels: ['A', 'B', 'C'],
    //                datasets: [
    //                    {
    //                        label: 'Dataset 1',
    //                        data: [1, 2, 3],
    //                        borderColor: '#36A2EB',
    //                        backgroundColor: '#9BD0F5',
    //                    },
    //                    {
    //                        label: 'Dataset 2',
    //                        data: [2, 3, 4],
    //                        borderColor: '#FF6384',
    //                        backgroundColor: '#FFB1C1',
    //                    }
    //                ]
    //            },
    //        );
    //        document.getElementById('chart-render').replaceChildren(canvas);
    //    } else {
    //        let span = document.createElement('span')
    //        span.className = 'chart-render-error';
    //        span.innerText = `${tabledata.name}: ${tabledata.message}`;
    //        document.getElementById('chart-render').replaceChildren(span);
    //    }
    //};
    //const chartRenderBtn = document.getElementById('che-render-chart-btn');
    //chartRenderBtn.addEventListener('click', updateChart);
    //function resetGroup(btn) {
    //    Array.from(btn.parentNode.querySelectorAll('[id^="che-config-"]')).forEach(el => {
    //        if (el.tagName.toLowerCase() === 'select') {
    //            el.value = "";
    //        } else if (el.type === 'checkbox') {
    //            el.checked = false;
    //        } else if (el.type === 'radio') {
    //            el.checked = el.value === '';
    //        } else {
    //            el.value = null;
    //        };
    //        updateChartEditorJson(el, configJson);
    //    });
    //};


};

function initChartEditor() {
    Chart.register(ChartDataLabels);
    Chart.defaults.responsive = true;
    //Chart.defaults.resizeDelay = 100;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.devicePixelRatio = 2;
    Chart.defaults.plugins.tooltip.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.position = 'right';
    Chart.defaults.plugins.legend.align = 'start';
    Chart.defaults.plugins.legend.reverse = true;
    Chart.defaults.scale.stacked = true;
    Chart.defaults.type = 'bar';
    Chart.defaults.color = '#ffffff';

    makeChartEditor(
        document.getElementById('chart-render'),
        document.getElementById('chart-form')
    );
}

//function delGroup(btn) {
//    const groupIter = btn.closest('.group-iter');
//    btn.parentNode.remove();
//    setGroupOrder(groupIter);
//    resetChartEditorJson(dataJson, Array.from(document.getElementById('chart-editor').querySelectorAll('[id^="che-data-"]')));
//};
//function addGroup(btn) {
//    const group = btn.previousElementSibling
//    const newGroupIter = group.lastChild.cloneNode(true);
//    const delBtn = document.createElement('button');
//    delBtn.id = btn.id.replace('-add-', '-del-');
//    delBtn.className = btn.className.replace('-add-', '-del-');
//    delBtn.addEventListener('click', (ev) => delGroup(ev.target));
//    newGroupIter.appendChild(delBtn);
//    btn.previousElementSibling.appendChild(newGroupIter);
//    setGroupOrder(group);
//    Array.from(newGroupIter.querySelectorAll('[id^="che-data-"]')).forEach(el => {
//        el.addEventListener('change', (ev) => {
//            updateChartEditorJson(ev.target, dataJson);
//            generateJsonFromChartEditor();
//        });
//    });
//};





//Dashboard
function makeDashboardEditor() {
    const openDashboardBtn = document.getElementById('de-open-dashboard-btn');
    const saveDashboardBtn = document.getElementById('de-save-dashboard-btn');
    const shareDashboardBtn = document.getElementById('de-share-dashboard-btn');
    const exportDashboardBtn = document.getElementById('de-export-dashboard-btn');
    saveDashboardBtn.addEventListener('click', saveDashboard);
    shareDashboardBtn.addEventListener('click', shareDashboard);
    exportDashboardBtn.addEventListener('click', exportDashboard);
    openDashboardBtn.addEventListener('click', dashListModalClick);
    
    async function saveDashboard() {
        updateGroupSizes();
        await loadDashboard(true);
        const name = prompt('Save dashboard as:')
        if (!name) {return;}
        const id = toSnakeCase(name);
        const data = {
            id: id,
            name: name,
            items: items,
            groups: groups,
        };
        try {
            dbPut('main', 'dashboards', data);
        } catch(err) {
            showAlert(err);
        }
    };
    function updateGroupSizes() {
        Array.from(document.getElementById('dashboard-render').querySelectorAll('.container')).forEach(el => {
            const id = el.id.split('-').pop(); 
            const defaultSplitPosition = Array.from(el.querySelectorAll(':scope>.handle')).map(h => h.getAttribute('data-split-position'));
            groups.find(g => g.id == id).defaultSplitPosition = defaultSplitPosition;
        })
    }
    async function shareDashboard() {
        updateGroupSizes();
        const data = {
            items: items,
            groups: groups,
        };
        const payload = LZString.compressToBase64(JSON.stringify(data));
        const shareUrl = `${window.location.origin}${window.location.pathname}dashboard#${payload}`;
        navigator.clipboard.writeText(shareUrl);
        window.open(shareUrl, "_blank");
    };
    function exportDashboard() {
        html2canvas(document.getElementById('dashboard-render'), { scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'dashboard.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    };

    const chartListModal = document.querySelector('.che-chart-list-modal').cloneNode(true);
    document.getElementById('dashboard-editor').appendChild(chartListModal)
    const chartListDialog = chartListModal.querySelector('.modal-dialog');
    const dashListModal = chartListModal.cloneNode(true);
    document.getElementById('dashboard-editor').appendChild(dashListModal)
    const dashListDialog = dashListModal.querySelector('.modal-dialog');
    dashListDialog.querySelector('h3').textContent = 'Saved Dashboards';
    
    function prepModal() {
        chartListDialog.querySelector('button.refresh').addEventListener('click', (ev) => refreshChartList(chartListDialog.querySelector('ul')));
        chartListModal.addEventListener("click", e => {
            if (!chartListDialog.contains(e.target)) {
                chartListModal.classList.remove("open");
            }
        });
        dashListDialog.querySelector('button.refresh').addEventListener('click', (ev) => refreshDashList(dashListDialog.querySelector('ul')));
        dashListModal.addEventListener("click", e => {
            if (!dashListDialog.contains(e.target)) {
                dashListModal.classList.remove("open");
            }
        });
    };
    prepModal();
    async function refreshChartList(ul) {
        const chartList = await backendListCharts();
        const liList = [0];
        if (chartList instanceof Error) {
            showAlert(chartList);
        } else {
            Array.from(ul.querySelectorAll('li')).forEach(c => c.remove());
            chartList.forEach(({ name, id }) => {
                const li = document.createElement('li');
                li.setAttribute('data-chart-id', id);
                const span = document.createElement('span');
                span.textContent = name;
                const div = document.createElement('div');
                div.className = 'btn-group';
                const addBtn = document.createElement('button');
                addBtn.className = 'icon-button add';
                div.appendChild(addBtn);
                li.appendChild(span);
                li.appendChild(div);
                ul.appendChild(li);
                li.addEventListener('click', (ev) => {
                    addChart(id, name);
                });
            });
        };
    };
    async function chartListModalClick(ev) {
        const ul = chartListModal.querySelector('ul');
        if (!ul.querySelector('li')) {
            console.log('refreshing');
            await refreshChartList(ul)
        };
        const rect = ev.target.getBoundingClientRect();
        const x = rect.right;
        const y = rect.top;
        chartListDialog.style.left = x - 200 + "px";
        chartListDialog.style.top = y + 20 + "px";
        chartListModal.classList.toggle('open');
    };

    async function refreshDashList(ul) {
        const dashList = await dbGetAll('main', 'dashboards');
        const liList = [0];
        if (dashList instanceof Error) {
            showAlert(dashList);
        } else {
            Array.from(ul.querySelectorAll('li')).forEach(c => c.remove());
            dashList.forEach(({ name, id }) => {
                const li = document.createElement('li');
                li.setAttribute('data-dash-id', id);
                const span = document.createElement('span');
                span.textContent = name;
                const div = document.createElement('div');
                div.className = 'btn-group';
                const editBtn = document.createElement('button');
                editBtn.className = 'icon-button edit';
                const removeBtn = document.createElement('button');
                removeBtn.className = 'icon-button remove';
                div.appendChild(editBtn);
                div.appendChild(removeBtn);
                li.appendChild(span);
                li.appendChild(div);
                ul.appendChild(li);
                removeBtn.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    if (confirm(`Deleting ${name} [${id}] ? It's you call...`)) {
                        dbDelete('main', 'dashboards', id);
                        li.remove();
                    };
                    //ev.stopPropagation();
                    //ev.preventDefault();
                });
                editBtn.addEventListener('click', async (ev) => {
                    if (confirm(`This will replace current dashboard. Sorry, tabs not implemented yet.`)) {
                        const dash = await dbGet('main', 'dashboards', id);
                        items = dash.items;
                        groups = dash.groups;
                        loadDashboard(true);
                    };
                    //ev.stopPropagation();
                    //ev.preventDefault();
                });
            });
        };
    };
    async function dashListModalClick(ev) {
        const ul = dashListModal.querySelector('ul');
        if (!ul.querySelector('li')) {
            console.log('refreshing');
            await refreshDashList(ul)
        };
        const rect = ev.target.getBoundingClientRect();
        const x = rect.right;
        const y = rect.top;
        dashListDialog.style.left = x - 200 + "px";
        dashListDialog.style.top = y + 20 + "px";
        dashListModal.classList.toggle('open');
    };


    let groups = [{ id: 1, parentId: null, name: `root`, orientation: 'v', position: 0 }];
    let items = [];
    let sortableSelectedParents;

    function makePanel(panelItems, defaultSplitPosition) {
        const out = [];
        const n = panelItems.length;
        if (!defaultSplitPosition || defaultSplitPosition.length==0) {
            defaultSplitPosition = [];
            let position = 0;
            const step = 100 / n;
            for (let i = 0; i < n; i++) {
                position += step;
                defaultSplitPosition.push(position);
            }
        };
        for (let i = 0; i < n; i++) {
            if (i > 0) {
                const handle = document.createElement('div');
                handle.className = 'handle';
                handle.setAttribute('data-default-split-position', String(defaultSplitPosition[i - 1]));
                out.push(handle);
            };
            const panel = document.createElement('div');
            panel.className = 'panel';
            console.log(panelItems[i]);
            if (panelItems[i]) {
                panel.appendChild(panelItems[i])
            };
            out.push(panel);
        };
        return out;
    };

    async function buildNode(item, full=false) {
        const div = document.createElement('div');
        div.id = `dashboard-chart-${item.id}`;
        if (item.id.startsWith('__text__')) {
            div.classList.add('dashboard-text');
            item.data.text = document.getElementById(item.id).value;
            const h = document.createElement('h3');
            h.textContent = item.data.text;
            div.appendChild(h);
            return div;
        }
        if (full || !item.data.jsonInput) {
            const chartData = await dbGet('main', 'charts', item.data.id);
            console.log(chartData.dataJson);
            item.data.jsonInput = await makeChartJson(chartData.dataJson, chartData.configJson);
            console.log(item.data.jsonInput);
        };
        makeChartFromJson(div, item.data.jsonInput);
        return div;
    };

    async function buildLayout(parentId = null, full=false) {
        window.groups = groups;
        window.items = items;
        if (!parentId) {
            parentId = groups.find(g => g.parentId == null)?.id;
        };
        const childGroups = groups
            .filter(g => g.parentId == parentId)
            .sort((a, b) => a.position - b.position);

        const childItems = items
            .filter(i => i.parentId == parentId)
            .sort((a, b) => a.position - b.position);

        //if (childGroups.length === 0 && childItems.length === 0) return null;

        const orientation = groups.find(g => g.id == parentId)?.orientation;
        const defaultSplitPosition = groups.find(g => g.id == parentId)?.defaultSplitPosition??[];

        const container = document.createElement('div');
        container.id = `dashboard-group-${parseInt(parentId)}`;
        container.className = `container ${orientation??'v'}-resizable`;

        const mergedChildren = await Promise.all([
            ...childGroups.map(async g => ({ type: 'group', node: await buildLayout(g.id,full), position: g.position })),
            ...childItems.map(async i => ({ type: 'item', node: await buildNode(i, full), position: i.position }))
        ]);
        mergedChildren.sort((a, b) => a.position - b.position);
        console.log(mergedChildren);
        const panelSequence = makePanel(mergedChildren.map(c => c.node), defaultSplitPosition);
        panelSequence.forEach(n => container.appendChild(n));

        makeResizable(container);
        return container;
    };

    function updateData(sortableSelectedParents, target, item) {
        //const prevPosition = item.previousElementSibling?.querySelector('div').getAttribute('data-de-sortable-position')??0;
        //const nextPosition = item.nextElementSibling?.querySelector('div').getAttribute('data-de-sortable-position')??99999999+1;
        //item.querySelector('div').setAttribute('data-de-sortable-position', (Number(nextPosition) - Number(prevPosition))/2 + Number(prevPosition));
        //return;
        const targetId = target.querySelector('.de-sortable-group').id.split('-').pop();
        const prevItem = sortableSelectedParents[0].node.previousElementSibling?.querySelector('.de-sortable-item, .de-sortable-group');
        const nextItem = sortableSelectedParents.reverse()[0].node.nextElementSibling?.querySelector('.de-sortable-item, .de-sortable-group');
        const minPosition = Number(prevItem?.getAttribute('data-de-sortable-position')??0);
        const maxPosition = Number(nextItem?.getAttribute('data-de-sortable-position')??minPosition+1000);
        const positionStep = (maxPosition - minPosition) / (sortableSelectedParents.length + 1);
        console.log(minPosition, maxPosition, positionStep, sortableSelectedParents);
        sortableSelectedParents.forEach((each, i) => {
            const eachGroup = each.node.querySelector('.de-sortable-group');
            if (eachGroup) {
                const group = groups.find(group => group.id == eachGroup.id.split('-').pop())
                group.parentId = targetId;
                group.position = minPosition + (i + 1) * positionStep;
            } else {
                const eachItem = each.node.querySelector('.de-sortable-item');
                const item = items.find(item => item.id == eachItem.id.split('-').pop())
                item.parentId = targetId;
                item.position = minPosition + (i + 1) * positionStep;
            }
            each.node.querySelector('div').setAttribute('data-de-sortable-position', minPosition + (i + 1) * positionStep);

        });
    };

    async function updateLayout(sortableSelectedParents, target, full=false) {
        const targetId = target.querySelector('.de-sortable-group').id.split('-').pop();
        console.log(targetId);
        const targetEl = document.getElementById(`dashboard-group-${targetId}`).parentNode;
        sortableSelectedParents.forEach(each => {
            const eachGroup = each.node.querySelector('.de-sortable-group');
            let el;
            if (eachGroup) {
                el = document.getElementById(`dashboard-group-${eachGroup.id.split('-').pop()}`).parentNode;
            } else {
                const eachItem = each.node.querySelector('.de-sortable-item');
                el = document.getElementById(`dashboard-chart-${eachItem.id.split('-').pop()}`).parentNode;
            };
            removeNextOrPreviousElement(el);
        });
        console.log(groups, targetId);
        const render = await buildLayout(targetId, full);
        targetEl.replaceChildren(render);
    };

    function makeSortable(el) {
        new Sortable(el, {
            group: 'nested',
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            multiDrag: true,
            multiDragKey: 'ctrl',
            selectedClass: 'sortable-selected',
            fallbackTolerance: 3,
            onStart: function (event) {
                const items = event.items.length ? event.items : [event.item];
                sortableSelectedParents = items.map(x => { return { parent: x.parentNode.querySelector('.de-sortable-group'), node: x } });
            },
            onEnd: function (event) {
                //var itemEl = evt.item;  // dragged HTMLElement
                //evt.to;    // target list
                //evt.from;  // previous list
                //evt.oldIndex;  // element's old index within old parent
                //evt.newIndex;  // element's new index within new parent
                //evt.oldDraggableIndex; // element's old index within old parent, only counting draggable elements
                //evt.newDraggableIndex; // element's new index within new parent, only counting draggable elements
                //evt.clone // the clone element
                //evt.pullMode;  // when item is in another sortable: `"clone"` if cloning, `true` if moving
                updateData(sortableSelectedParents, event.to, event.item);
                updateLayout(sortableSelectedParents, event.to);
            },
        });
    };

    function removeResizableElement(el) {
        const prev = el.previousElementSibling;
        const next = el.nextElementSibling;
        
        if (prev?.classList.contains('handle')) {
            prev.remove();
        } else if (next?.classList.contains('handle')) {
            next.remove();
        };
        el.remove();
    }
    function deleteFromDashboard(type, id) {
        if (type == 'item') {
            items = items.filter(item => item.id !== id);
            const el = document.getElementById(`dashboard-chart-${id}`).parentNode;
            removeResizableElement(el);
        } else {
            items = items.filter(item => item.parentId !== id);
            groups = groups.filter(groups => groups.id !== id);
            const el = document.getElementById(`dashboard-group-${id}`).parentNode;
            removeResizableElement(el);
        };
        document.getElementById(`de-sortable-${type}-${id}`).parentNode.remove();
    }

    function rotateGroup(id) {
        const group = groups.find(g => g.id == id);
        group.orientation = group.orientation == 'h' ? 'v' : 'h';
        const el = document.getElementById(`dashboard-group-${id}`);
        if (el.classList.contains('v-resizable')) {
            el.classList.remove('v-resizable');
            el.classList.add('h-resizable');
        } else {
            el.classList.remove('h-resizable');
            el.classList.add('v-resizable');
        };
        const elIcon = document.getElementById(`de-sortable-group-${id}`).querySelector('.fa-solid.fa-retweet');
        if (elIcon.classList.contains('fa-rotate-90')) {
            elIcon.classList.remove('fa-rotate-90');
        } else {
            elIcon.classList.add('fa-rotate-90');
        };
    }

    function makeSortableItem(item) {
        if (item.id.startsWith('__text__')) {return makeSortableTextItem(item);};
        const div = document.createElement('div');
        const span = document.createElement('span');
        const i = document.createElement('i');
        div.className = 'de-sortable-item';
        div.id = `de-sortable-item-${item.id}`;
        div.setAttribute('data-de-sortable-position', item.position);
        i.className = "fa-solid fa-trash";
        span.textContent = item.name;
        div.appendChild(span);
        div.appendChild(i);
        i.addEventListener('click', (event) => {
            event.stopImmediatePropagation();
            deleteFromDashboard('item', item.id)
        });
        return div;
    };

    function makeSortableTextItem(item) {
        const div = document.createElement('div');
        const input = document.createElement('input');
        input.id = item.id;
        const i = document.createElement('i');
        div.className = 'de-sortable-item';
        div.id = `de-sortable-item-${item.id}`;
        div.setAttribute('data-de-sortable-position', item.position);
        i.className = "fa-solid fa-trash";
        input.value = item?.data.text??'Text';
        div.appendChild(input);
        div.appendChild(i);
        i.addEventListener('click', (event) => {
            event.stopImmediatePropagation();
            deleteFromDashboard('item', item.id)
        });
        input.addEventListener('input', (ev) => {
            const dashChart = document.getElementById(`dashboard-chart-${item.id}`);
            dashChart.querySelector('h3').textContent = input.value;
            items.find(g => g.id==item.id).name = input.value;
            items.find(g => g.id==item.id).data.text = input.value;
        });
        return div;
    };

    function makeSortableGroupItem(g) {
        const ul = document.createElement('ul');
        ul.className = `sortable`;
        const div = document.createElement('div');
        const span = document.createElement('span');
        const i = document.createElement('i');
        const iFlip = document.createElement('i');
        div.className = 'de-sortable-group';
        div.id = `de-sortable-group-${g.id}`;
        div.setAttribute('data-de-sortable-position', g.position);
        i.className = "fa-solid fa-trash";
        iFlip.className = `fa-solid fa-retweet ${g.orientation == 'v' ? 'fa-rotate-90' : ''}`
        span.textContent = `${g.orientation}, ${g.name}`;
        div.appendChild(span);
        div.appendChild(iFlip);
        div.appendChild(i);
        ul.appendChild(div);
        makeSortable(ul);
        i.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteFromDashboard('group', g.id);
        });
        iFlip.addEventListener('click', (event) => {
            event.stopPropagation();
            rotateGroup(g.id);
        });
        [i, iFlip].forEach(btn => {
            btn.addEventListener('pointerdown', e => e.stopPropagation());
            btn.addEventListener('mousedown', e => e.stopPropagation());
        });
        return ul;
    };

    function buildLayoutList(parentId = null) {
        if (!parentId) {
            parentId = groups.find(g => g.parentId == null).id;
        };
        const childGroups = groups
            .filter(g => g.parentId == parentId)
            .sort((a, b) => a.position - b.position);

        const childItems = items
            .filter(i => i.parentId == parentId)
            .sort((a, b) => a.position - b.position);

        //if (childGroups.length === 0 && childItems.length === 0 && parentId != 1) return null;

        const g = groups.find(g => g.id === parentId);
        const ul = makeSortableGroupItem(g);
        const mergedChildren = [
            ...childGroups.map(g => ({ type: 'group', node: buildLayoutList(g.id), position: g.position })),
            ...childItems.map(i => ({ type: 'item', node: makeSortableItem(i), position: i.position }))
        ];
        console.log(mergedChildren);
        mergedChildren.sort((a, b) => a.position - b.position);
        mergedChildren.forEach(n => {
            const li = document.createElement('li');
            li.appendChild(n.node);
            ul.appendChild(li);
        });
        return ul;
    };
    async function loadDashboard(full=false) {
        const response = [[], []];
        if (!(response instanceof Error)) {
            const form = buildLayoutList();
            console.log(form);
            document.getElementById('dashboard-form-sortable').replaceChildren(form);
            const render = await buildLayout(null, full);
            document.getElementById('dashboard-render').replaceChildren(render);
        } else {
            let span = document.createElement('span')
            span.className = 'dashboard-render-error';
            span.innerText = `${response.name}: ${response.message}`;
            document.getElementById('dashboard-render').replaceChildren(span);
            document.getElementById('dashboard-form-sortable').replaceChildren(span);
        }
    };
    loadDashboard();
    async function addGroup() {
        const maxId = groups?.length > 0 ? Math.max(...groups.map(g => g.id)) : 0;
        const maxPosition = Math.max(
            items.length > 0 ? Math.max(...items.filter(g => g).map(g => g.position)) : 0,
            groups.length > 0 ? Math.max(...groups.filter(g => g).map(g => g.position)) : 0
        );
        const newGroup = { id: maxId + 1, parentId: 1, name: `col${maxId + 1}`, orientation: 'v', position: Number(maxPosition) + 1000 };
        groups.push(newGroup);
        const newGroupItem = makeSortableGroupItem(newGroup);
        const li = document.createElement('li');
        li.appendChild(newGroupItem);
        document.getElementById('dashboard-form-sortable').querySelector('ul.sortable').appendChild(li);
        const render = await buildLayout();
        document.getElementById('dashboard-render').replaceChildren(render);
    };
    async function addChart(id, name) {
        const maxPosition = Math.max(
            items?.length > 0 ? Math.max(...items.filter(g => g).map(g => g.position)) : 0,
            groups?.length > 0 ? Math.max(...groups.filter(g => g).map(g => g.position)) : 0
        );
        const newItem = { id: id + '_' + generateId(4), parentId: 1, name: name, data: {id: id}, position: Number(maxPosition) + 1000 };
        items.push(newItem);
        const newChart = makeSortableItem(newItem);
        const li = document.createElement('li');
        li.appendChild(newChart);
        document.getElementById('dashboard-form-sortable').querySelector('ul.sortable').appendChild(li);
        const render = await buildLayout();
        document.getElementById('dashboard-render').replaceChildren(render);
    };
    async function addText() {
        const maxPosition = Math.max(
            items?.length > 0 ? Math.max(...items.filter(g => g).map(g => g.position)) : 0,
            groups?.length > 0 ? Math.max(...groups.filter(g => g).map(g => g.position)) : 0
        );
        const id = '__text__' + generateId(4)
        const newItem = { id: id, parentId: 1, name: 'Text', data: {id: id}, position: Number(maxPosition) + 1000 };
        items.push(newItem);
        const newChart = makeSortableTextItem(newItem);
        const li = document.createElement('li');
        li.appendChild(newChart);
        document.getElementById('dashboard-form-sortable').querySelector('ul.sortable').appendChild(li);
        const render = await buildLayout();
        document.getElementById('dashboard-render').replaceChildren(render);
    };
    const dashRenderBtn = document.getElementById('de-run-dashboard-btn');
    dashRenderBtn.addEventListener('click', (ev) => loadDashboard(true));
    const dashAddGroupBtn = document.getElementById('de-add-group-btn');
    dashAddGroupBtn.addEventListener('click', addGroup);
    const dashAddTextBtn = document.getElementById('de-add-text-btn');
    dashAddTextBtn.addEventListener('click', addText);
    const dashAddChartBtn = document.getElementById('de-add-chart-btn');
    dashAddChartBtn.addEventListener('click', chartListModalClick);
};


// Prep
if (document.readyState === 'complete') {
    console.log('Components Init');
    initComponents();
    console.log('Components Completed');

    console.log('Resizable Init');
    initResizable();
    console.log('Resizable Completed');

    console.log('Catalog Explorer Init');
    initCatalogExplorer();
    console.log('Catalog Explorer Completed');

    console.log('Query Editor Init');
    initQueryEditor();
    console.log('Query Editor Completed');

    console.log('Chart Editor Init');
    initChartEditor();
    console.log('Chart Editor Completed');

    //Chart
    //const chartConfigForm = document.getElementById('chart-config-form');
    //const chartEditorConfig = Array.from(chartConfigForm.querySelectorAll('[id^="che-config-"]'));
    //const chartEditorData = Array.from(chartConfigForm.querySelectorAll('[id^="che-data-"]'));
    //setChartJsDefaults();
    //resetChartEditorJson(configJson, chartEditorConfig);
    //resetChartEditorJson(dataJson, chartEditorData);
    //generateJsonFromChartEditor();
    //chartEditorConfig.forEach(el => {
    //    el.addEventListener('change', (ev) => {
    //        updateChartEditorJson(ev.target, configJson);
    //        generateJsonFromChartEditor();
    //    });
    //});
    //chartEditorData.forEach(el => {
    //    el.addEventListener('change', (ev) => {
    //        updateChartEditorJson(ev.target, dataJson);
    //        generateJsonFromChartEditor();
    //    });
    //});
    //document.getElementById('che-sortable-metrics-add-stack-btn').addEventListener('click', (ev) => addStack(ev.target));
    //Array.from(chartConfigForm.querySelectorAll('.add-btn')).forEach(btn => btn.addEventListener('click', (ev) => {
    //    addGroup(ev.target);
    //    generateJsonFromChartEditor();
    //}));
    //Array.from(chartConfigForm.querySelectorAll('.reset-btn')).forEach(btn => btn.addEventListener('click', (ev) => {
    //    resetGroup(ev.target);
    //}));
    //Array.from(document.getElementById('chart-editor').querySelectorAll('.sortable')).forEach(el => makeSortable(el));
    //Array.from(document.getElementsByClassName('adv-toggle')).forEach(el => el.addEventListener('click', (event) => {
    //    event.target.closest('.group').querySelector('.advanced-section').style.display = event.target.checked ? 'block' : 'none'
    //}));
    //makeChartEditor();

    //activeQueryTarget.addEventListener('change', generateJsonFromChartEditor);

    //Dashboard
    makeDashboardEditor();
};


// debug
async function watchCSS(url, intervalMs = 1000) {
    let lastHash = null;

    while (true) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            const text = await res.text();
            const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
            const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

            if (hex !== lastHash) {
                lastHash = hex;

                const link = document.querySelector(`link[href*="${url}"]`);
                if (link) {
                    const base = url.split('?')[0];
                    const newLink = link.cloneNode();
                    newLink.href = `${base}?v=${Date.now()}`;
                    link.replaceWith(newLink);
                }
            }
        } catch (e) {
            // ignore fetch errors
        }

        await new Promise(r => setTimeout(r, intervalMs));
    }
}

// usage
//watchCSS("assets/styles.css", 1000);