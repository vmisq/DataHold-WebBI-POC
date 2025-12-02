require.config({ paths: { "vs": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.29.1/min/vs/" }});

window.MonacoEnvironment = {
    getWorkerUrl: function(workerId, label) {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = { baseUrl: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.29.1/min/" };
            importScripts("https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.29.1/min/vs/base/worker/workerMain.min.js");`
        )}`;
    }
};

require(["vs/editor/editor.main"], function () {
    window.editor = monaco.editor.create(document.getElementById("editor"), {
        value: "-- write a sql for any table in the catalog\n-- only public_url and uploaded for now",
        language: "sql",
        theme: 'vs-dark',
    });

    const editorElement = document.getElementById("editor");
    const resizeObserver = new ResizeObserver(() => {
        window.editor.layout({
            width: editorElement.offsetWidth,
            height: editorElement.offsetHeight
        });
    });
    resizeObserver.observe(editorElement);
});