
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

function initDashboard() {
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
}

//Dashboard
async function makeDashboard(groups, items) {
    function makePanel(panelItems, defaultSplitPosition) {
        const out = [];
        const n = panelItems.length;
        if (!defaultSplitPosition) {
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
            //item.data.text = document.getElementById(item.id).value;
            const h = document.createElement('h3');
            h.textContent = item.data.text;
            div.appendChild(h);
            return div;
        }
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
    const render = await buildLayout();
    document.getElementById('dashboard-render').replaceChildren(render);
};


// Prep
const id = window.location.hash.slice(1);
console.log(id);
const dashData = JSON.parse(LZString.decompressFromBase64(id));
console.log(dashData);
initDashboard();
makeDashboard(dashData.groups, dashData.items);


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