import dominate
from dominate.tags import *

stylesheets = [
    #'assets/resizable.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    #"https://unpkg.com/tabulator-tables@6.3.1/dist/css/tabulator.min.css",
    #"https://unpkg.com/tabulator-tables@6.3.1/dist/css/tabulator_bootstrap4.min.css",
    #"https://unpkg.com/gridjs/dist/theme/mermaid.min.css",
    #'assets/gridjs.css',
    'assets/styles.css',
]
scripts = [
    #"https://unpkg.com/tabulator-tables@6.3.1/dist/js/tabulator.min.js",
    #"https://unpkg.com/gridjs@6.2.0/dist/gridjs.js",
    #"scripts/monaco.js",
    #'https://cdn.jsdelivr.net/npm/chart.js'
]
modules = [
    "scripts/indexedDB.js",
    "scripts/duckDB.js",
    "scripts/backend.js",
]

def make_panel(panel_items, default_split_position=None):
    if not default_split_position:
        n = len(panel_items)
        position = 0
        default_split_position = [(position := position + x) for x in [100/n]*n]
    for i, panel in enumerate(panel_items):
        if i:
            yield div(cls='handle', data_default_split_position=default_split_position[i-1])
        yield div(panel, cls='panel')

doc = dominate.document(title='♖ DataHold')

with div(id='navbar') as navbar:
    with ul():
        h3('♖ DataHold WebBI POC')
        #for text, icon in [
        #    ('gallery', 'fa-solid fa-folder'),
        #    ('library', 'fa-solid fa-book-open'),
        #    ('lab', 'fa-solid fa-flask'),
        #    ('forge', 'fa-solid fa-hammer'),
        #    ('monitor', 'fa-solid fa-binoculars'),
        #    ('admin', 'fa-solid fa-shield'),
        #]:
        #    li(a(i(cls=icon), text.title(), href='/%s.html' % text))
        #button('settings')

with div(id='ce-root-file-storage-public-url-modal', cls='modal') as fs_public_url_modal:
    with div(cls='modal-dialog'):
        with div(cls='modal-opt'):
            span('URL')
            input_(id='ce-root-file-storage-public-url-modal-url', type='url')
            div(id='ce-root-file-storage-public-url-modal-url-msg', cls='ce-error-msg')
        with div(cls='data-column-opt type'):
            span('Type')
            with select(id='ce-root-file-storage-public-url-modal-type'):
                option('Parquet', value='parquet')
                option('CSV', value='csv')
                option('JSON', value='json')
        with div(cls='modal-opt'):
            span('Query as')
            input_(id='ce-root-file-storage-public-url-modal-id', type='text')
        button('Add this Public URL', cls='text-button')
        div(id='ce-root-file-storage-public-url-modal-submit-msg', cls='ce-error-msg')
        
with div(id='ce-root-file-storage-uploaded-modal', cls='modal') as fs_uploaded_modal:
    with div(cls='modal-dialog'):
        with div(cls='modal-opt'):
            span('Select file to upload')
            input_(id='ce-root-file-storage-uploaded-modal-file', type='file')
            div(id='ce-root-file-storage-uploaded-modal-file-msg', cls='ce-error-msg')
        with div(cls='data-column-opt type'):
            span('Type')
            with select(id='ce-root-file-storage-uploaded-modal-type'):
                option('Parquet', value='parquet')
                option('CSV', value='csv')
                option('JSON', value='json')
        with div(cls='modal-opt'):
            span('Query as')
            input_(id='ce-root-file-storage-uploaded-modal-id', type='text')
        button('Add this file', cls='text-button')
        div(id='ce-root-file-storage-uploaded-modal-submit-msg', cls='ce-error-msg')

with div(id='catalog-explorer') as catalog_explorer:
    with div(cls='panel-header'):
        h3('Catalog Explorer')
        div(cls='btn-group')
            #i(cls="fa-solid fa-ellipsis ce-more-btn")
    with div(cls='panel-content'):
        catalog_explorer.add(fs_public_url_modal)
        catalog_explorer.add(fs_uploaded_modal)
        with ul():
            for ce_id, catalog_type in enumerate([
                'data_marts',
                'data_warehouse',
                'external_databases',
                'file_storage',
                #'perspectives',
                'saved_queries',
                #'temp',
            ]):
                with li():
                    with ul(id=f'ce-root-{catalog_type.replace('_', '-')}', cls='ce-closed ce-catalog'):
                        with div(cls='ce-header'):
                            with div(cls='ce-header-text'):
                                span(' '.join([ct.title() for ct in catalog_type.split('_')]))
                            #with div(cls='ce-header-btn-group'):
                            #    button(cls='icon-button refresh')
                            #    button(cls='icon-button edit')

with div(id='query-editor') as query_editor:
    with div(cls='panel-header'):
        h3('Query Editor')
        with div(cls='btn-group'):
            button(id='qe-save-query-btn', cls="icon-button save")
            button(id='qe-run-query-btn', cls="icon-button run")
    with div(cls='panel-content'):
        div(id='editor')

with div(id='query-results') as query_results:
    with div(cls='panel-header'):
        h3('Query Results')
        with div(cls='btn-group'):
            button(id='qe-copy-query-btn', cls="icon-button copy")
            button(id='qe-export-query-btn', cls="icon-button export")
    with div(cls='panel-content'):
        div(id='query-results-output')

with div(cls='modal che-chart-list-modal') as che_chart_list_modal:
    with div(cls='modal-dialog'):
        with ul():
            with div(cls='che-chart-list-modal-header'):
                with div(cls='che-chart-list-modal-header-text'):
                    h3('Saved Charts')
                with div(cls='che-chart-list-modal-header-btn-group btn-group'):
                    button(cls='icon-button refresh')
                #    button(cls='icon-button edit')
        
with div(cls='chart-form-group') as chart_editor_data_source:
    h3('Data Source')
    with div(id='che-data-source-type', cls="radio-group"):
        for n, opt in enumerate(["Query Editor", "Saved Query", "Table"]):
            with label():
                input_(
                    type="radio",
                    name='che-data-source-type',
                    value=opt.lower().replace(' ', '-'),
                    checked=n==0,
                )
                span(opt)
    with select(id='che-data-source', data_path='source'):
        option('Active Tab', value='_active')
    with ul(id='che-sortable-column-list', cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Column List')
    # button('Add Custom Expression', id='che-sortable-column-list-add-expr-btn')
    
with div(id='che-sortable-col-edit-modal', cls='modal') as chart_editor_column_modal:
    with div(cls='modal-dialog'):
        with div(cls='data-column-opt display'):
            span('Display Name')
            input_(id='che-sortable-col-edit-modal-display', type='text', data_tgt_data='data-column-display')
        with div(cls='data-column-opt expr'):
            span('Expression')
            input_(id='che-sortable-col-edit-modal-expr', type='text', data_tgt_data='data-column-expr')
        with div(cls='data-column-opt agg'):
            span('Aggregate')
            with select(id='che-sortable-col-edit-modal-agg', data_tgt_data='data-column-agg'):
                option('None', value='_col_', id='none-agg-option')
                option('COUNT', value='COUNT(_col_)')
                option('UNIQUE', value='COUNT(DISTINCT _col_)')
                option('SUM', value='SUM(_col_)')
                option('AVG', value='AVG(_col_)')
                option('MIN', value='MIN(_col_)')
                option('MAX', value='MAX(_col_)')
        with div(cls='data-column-opt type'):
            span('Type')
            with select(id='che-sortable-col-edit-modal-type', data_tgt_data='data-column-type'):
                option('Bar', value='bar')
                option('Line', value='line')
        #with div(cls='data-column-opt fill'):
        #    span('Fill Color')
            #with select(id='che-sortable-col-edit-modal-fill', data_tgt_data='data-column-fill'):
            #    option('Auto', value='auto')
            #    option('None', value='None')
            #    option('Accent #1', value='accent-1')
            #    option('Accent #2', value='accent-2')
            #    option('Accent #3', value='accent-3')
            #    option('Accent #4', value='accent-4')
            #    option('Accent #5', value='accent-5')
            #    option('Accent #6', value='accent-6')
            #    option('Accent #7', value='accent-7')
        #with div():
        #    span('Border Color')
            #with select(id='che-sortable-col-edit-modal-border', data_tgt_data='data-column-border'):
            #    option('Same as fill', value='None')
            #    option('Black', value='black')
            #    option('Gray', value='gray')
            #    option('White', value='white')   
        
with div(cls='chart-form-group') as chart_editor_data_options:
    h3('Data Options')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Chart Type')
        with div(cls="radio-group"):
            for n, opt in enumerate(["Bar/Line", "Scatter", "Radial", "Card", "Table"]):
                with label():
                    input_(
                        type="radio",
                        name='che-data-chart-type',
                        value=opt.lower(),
                        checked=n==0,
                        disabled=n!=0,
                    )
                    span(opt)
    chart_editor_data_options.add(chart_editor_column_modal)
    with ul(id='che-sortable-x-axis-parent', cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('X Axis or Category')
        with li():
            with ul(cls='data-source-opt'):
                with div(cls='che-sortable-subheader'):
                    span('Ticks')
                    with div(cls='btn-group'):
                        button('Group By', id='che-sortable-group-by', cls='group-by text-button switch-button active')
                ul(id='che-sortable-x-axis', cls='sortable sortable-target-cols data-source-opt')
                #with div(cls='che-sortable-subheader'):
                #    span('Group By')
                #    with div(cls='che-sortable-group-by-wrapper'):
                #        input_(id='che-sortable-group-by', cls='switch', type='checkbox', checked=True)
                #        span(cls='slider')
    with ul(id='che-sortable-y-axis', cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Y Axis or Metric')
        with li():
            with ul(cls='sortable sortable-target-cols che-sortable-y-axis-stack'):
                with div(cls='che-sortable-subheader'):
                    span('Stack')
                    with div(cls='btn-group'):
                        button(cls='move-up icon-button')
                        button(cls='move-down icon-button')
                        button(cls='remove icon-button')
            with ul(cls='sortable sortable-target-cols sortable-one che-sortable-y-axis-stack-color-by'):
                with div(cls='che-sortable-footer'):
                    span('Color By')
        button('Add Stack', id='che-sortable-metrics-add-stack-btn')
    with ul(id='che-sortable-multiple-v', cls='sortable sortable-target-cols sortable-one data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Vertical Facet')
    with ul(id='che-sortable-multiple-h', cls='sortable sortable-target-cols sortable-one data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Horizontal Facet')
        
with div(cls='chart-form-group') as chart_editor_chart_options:
    h3('Chart Options')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Title')
        input_(type="text", id='che-data-chart-title')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Subtitle')
        input_(type="text", id='che-data-chart-subtitle')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('X Axis')
        div(cls='work-in-progress')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Y Axis')
        div(cls='work-in-progress')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Data Labels')
        div(cls='work-in-progress')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Legend')
        div(cls='work-in-progress')
    with div(cls='data-source-opt'):
        with div(cls='che-sortable-header'):
            span('Tooltip')
        div(cls='work-in-progress')

with div(id='chart-editor') as chart_editor:
    chart_editor.add(che_chart_list_modal)
    with div(cls='panel-header'):
        h3('Chart Editor')
        with div(cls='btn-group'):
            button(id='che-open-chart-btn', cls="icon-button open")
            button(id='che-save-chart-btn', cls="icon-button save")
            button(id='che-run-chart-btn', cls="icon-button run")
    with div(cls='panel-content'):
        with div(id='chart-form'):
            div(*[i for i in make_panel([
                chart_editor_data_source,
                chart_editor_data_options,
                chart_editor_chart_options
            ])], cls='container h-resizable'),

with div(id='chart-preview') as chart_preview:
    with div(cls='panel-header'):
        h3('Chart Preview')
        with div(cls='btn-group'):
            button(id='che-copy-chart-btn', cls="icon-button copy")
            button(id='che-export-chart-btn', cls="icon-button export")
    with div(cls='panel-content'):
        div(id='chart-render')

with div(id='dashboard-preview') as dashboard_preview:
    with div(cls='panel-header'):
        h3('Dashboard Preview')
        with div(cls='btn-group'):
            button(id='de-share-dashboard-btn', cls="icon-button share")
            button(id='de-export-dashboard-btn', cls="icon-button export")
    with div(cls='panel-content'):
        div(id='dashboard-render')

with div(id='dashboard-editor') as dashboard_editor:
    with div(cls='panel-header'):
        h3('Dashboard Editor')
        with div(cls='btn-group'):
            button(id='de-open-dashboard-btn', cls="icon-button open")
            button(id='de-save-dashboard-btn', cls="icon-button save")
            button(id='de-run-dashboard-btn', cls="icon-button run")
    with div(cls='panel-content'):
        with div(id='dashboard-form'):
            with div(id='de-form-btn-group'):
                with div(id='de-add-text-btn'):
                    i(cls="fa-solid fa-plus")
                    span('Text')
                with div(id='de-add-chart-btn'):
                    i(cls="fa-solid fa-plus")
                    span('Chart')
                with div(id='de-add-group-btn'):
                    i(cls="fa-solid fa-plus")
                    span('Group')
            div(id='dashboard-form-sortable')

with doc.head:
    for href in stylesheets:
        link(rel='stylesheet', href=href)
    for href in scripts:
        script(type='text/javascript', href=href)
    for href in modules:
        script(type='module', href=href)

doc.add(navbar)
doc.add(div(id='alert-box'))
#doc.add(script(src='https://cdn.jsdelivr.net/npm/chart.js'))
with doc:
    with div(id='content'):
        div(*[i for i in make_panel([
            div(*[i for i in make_panel([
                catalog_explorer,
                div(*[i for i in make_panel([
                    query_editor,
                    query_results
                ])], cls='container v-resizable'),
            ], default_split_position=[30,70])], cls='container h-resizable'),
            div(*[i for i in make_panel([
                chart_editor,
                chart_preview
            ])], cls='container v-resizable'),
            div(*[i for i in make_panel([
                dashboard_editor,
                dashboard_preview
            ], default_split_position=[30,70])], cls='container h-resizable'),
        ])], cls='container h-resizable')

with doc:
    script(src='https://html2canvas.hertzen.com/dist/html2canvas.min.js')
    script(src='https://cdn.jsdelivr.net/npm/chart.js')
    script(src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js")
    script(src='https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js')
    #script(src='scripts/debug.js')
    #script(src='scripts/datalabels.js')
    script(src="https://cdnjs.cloudflare.com/ajax/libs/list.js/2.3.1/list.min.js")
    script(src='https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js')
    script(src='https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.29.1/min/vs/loader.min.js')
    script(src='https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js')
    script(type='module', src='scripts/main.js')
    script(src="scripts/monaco.js")

docDash = dominate.document(title='♖ Dashboard')
with docDash.head:
    link(rel='stylesheet', href='assets/styles.css')
with docDash:
    div(id='dashboard-render')
    script(src='https://cdn.jsdelivr.net/npm/chart.js')
    script(src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js")
    script(src='https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js')
    script(src='https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js')
    script(type='module', src='scripts/dashboard.js')

with open('index.html', 'w') as f:
    f.write(doc.render(pretty=False))
    
with open('dashboard.html', 'w') as f:
    f.write(docDash.render(pretty=False))