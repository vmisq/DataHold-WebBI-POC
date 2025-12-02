const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
export function dbInit(db, initialData, v) {
    const open = indexedDB.open(db, v);
    console.log(v);
    open.onupgradeneeded = function() {
        console.log('UPGRADEEEE');
        initialData.forEach(({store, index, data}) => {
            if (open.result.objectStoreNames.contains(store)) {return;};
            const st = open.result.createObjectStore(store, { keyPath: 'id' });
            if (index) {
                st.createIndex(index, index, { unique: false });
            }
            data.forEach(d => st.put(d));
            st.transaction.oncomplete = () => {
                console.log(`${db}.${store} did not exist and was created with ${index} as index`);
            };
        });
    };
};
export function dbPut(db, store, data) {
    const open = indexedDB.open(db);
    open.onsuccess = function() {
        const tx = open.result.transaction(store, 'readwrite');
        const st = tx.objectStore(store);
        const put = st.put(data);
        put.onsuccess = function () {
            console.log(`${data} added to indexedDB with success`) 
        };
    };
};
export function dbDelete(db, store, id) {
    const open = indexedDB.open(db);
    open.onsuccess = function() {
        const tx = open.result.transaction(store, 'readwrite');
        const st = tx.objectStore(store);
        const put = st.delete(id);
        put.onsuccess = function () {
            console.log(`${id} deleted from indexedDB with success`) 
        };
    };
};
export function dbGet(db, store, id) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onsuccess = function() {
            const tx = open.result.transaction(store, 'readonly');
            const st = tx.objectStore(store);
            const get = st.get(id);
            get.onsuccess = function () {
                resolve(get.result);
            };
            get.onerror = function(e) {
                reject(e);
            };
        };
        open.onerror = function(e) {
            reject(e);
        };
    });
};
export function dbGetByIndex(db, store, index, indexValue) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onsuccess = function() {
            const tx = open.result.transaction(store, 'readonly');
            const st = tx.objectStore(store);
            const idx = st.index(index);
            const get = idx.getAll(indexValue);
            get.onsuccess = function () {
                resolve(get.result);
            };
            get.onerror = function(e) {
                reject(e);
            };
        };
        open.onerror = function(e) {
            reject(e);
        };
    });
};
export function dbGetAll(db, store) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onsuccess = function() {
            const tx = open.result.transaction(store, 'readonly');
            const st = tx.objectStore(store);
            const get = st.getAll();
            get.onsuccess = function () {
                resolve(get.result);
            };
            get.onerror = function(e) {
                reject(e);
            };
        };
        open.onerror = function(e) {
            reject(e);
        };
    });
};
export function dbG(db, store, id) {dbGet(db, store, id).then(data => {console.log(data);});};
window.dbG = dbG;