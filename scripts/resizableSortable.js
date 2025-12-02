new Sortable(document.getElementById('source'), {
  group: {
    name: 'shared',
    pull: 'clone',
    put: false,
  },
  draggable: '.object',
  filter: '.resize-handle',
  sort: false,
  onEnd: (ev) => {
    if (ev.to === ev.from) {return};
    const item = ev.item;
    const box = document.createElement('div');
    box.className = "box box-splitter";
    item.appendChild(box);
    makeSortableSplitter(box);
    const boxOverlay = document.createElement('div');
    boxOverlay.className = "box-splitter-overlay"
    box.appendChild(boxOverlay);
    box.addEventListener('dragover', (e) => {
      const rect = box.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const topDist = y / rect.height;
      const bottomDist = 1 - topDist;
      const leftDist = x / rect.width;
      const rightDist = 1 - leftDist;
      const minDist = Math.min(topDist, bottomDist, leftDist, rightDist);
      box.style.inset = "0px";
      boxOverlay.style.display = 'block';
      if (minDist === topDist) {
        boxOverlay.style.top = '0';
        boxOverlay.style.right = '0';
        boxOverlay.style.bottom = '50%';
        boxOverlay.style.left = '0';
        box.setAttribute('data-split-direction', 'top');
      } else if (minDist === bottomDist) {
        boxOverlay.style.top = '50%';
        boxOverlay.style.right = '0';
        boxOverlay.style.bottom = '0';
        boxOverlay.style.left = '0';
        box.setAttribute('data-split-direction', 'bottom');
      } else if (minDist === leftDist) {
        boxOverlay.style.top = '0';
        boxOverlay.style.right = '50%';
        boxOverlay.style.bottom = '0';
        boxOverlay.style.left = '0';
        box.setAttribute('data-split-direction', 'left');
      } else if (minDist === rightDist) {
        boxOverlay.style.top = '0';
        boxOverlay.style.right = '0';
        boxOverlay.style.bottom = '0';
        boxOverlay.style.left = '50%';
        box.setAttribute('data-split-direction', 'right');
      }
    });
    box.addEventListener('dragleave', (e) => {
      boxOverlay.style.display = 'none';
      box.style.inset = "min(20px, 10%)";
    });
    box.addEventListener('drop', (e) => {
      boxOverlay.style.display = 'none';
      box.style.inset = "min(20px, 10%)";
    });
    const resizeHandle = makeResizeHandle();
    item.appendChild(resizeHandle);
    const moveHandle = document.createElement('div');
    moveHandle.className = 'move-handle';
    item.querySelector('.object-content').appendChild(moveHandle);
  }
});

new Sortable(document.getElementById('trash'), {
  group: 'shared',
  onAdd: (ev) => {ev.item.remove()}
});

function makeSortableSplitter(box) {
  new Sortable(box, {
    group: 'shared',
    draggable: '.object',
    filter: '.resize-handle',
    fallbackOnBody: true,
    onAdd: (ev) => {
      const direction = ev.to.getAttribute('data-split-direction');
      const item = ev.item;
      const sibling = ev.to.closest('.object');
      const siblingFlex = sibling.style.flex;
      console.log(siblingFlex);
      const object = document.createElement('div');
      object.className = 'object';
      object.style.flex = siblingFlex;
      item.style.flex = siblingFlex;
      const box = document.createElement('div');
      if (['top', 'bottom'].includes(direction)) {
        box.className = 'box box-v';
      } else {
        box.className = 'box box-h';
      };
      sibling.before(object);
      object.append(box);
      if (['top', 'left'].includes(direction)) {
        box.appendChild(item);
        box.appendChild(sibling);
      } else {
        box.appendChild(sibling);
        box.appendChild(item);
      };
      makeSortableTarget(box);
      const resizeHandle = makeResizeHandle();
      object.appendChild(resizeHandle);
    }
  });
};

function makeSortableTarget(el) {
  new Sortable(el, {
    group: 'shared',
    handle: '.move-handle',
    draggable: '.object',
    filter: '.resize-handle',
    swapThreshold: 0.5,
  });
};

function setFlexFromPos(box, pos) {
  let cur = 0;
  box.querySelectorAll(':scope>.object').forEach((child, i) => {
    child.style.flex = pos[i] - cur;
    cur = pos[i];
  });
  box.setAttribute('data-resize-handles-pos', pos.join(','));
};

function resize(e, resizeHandle, box, initPos, resizeHandles) {
  console.log(e, resizeHandle, box, initPos, resizeHandles);
  const oldPos = (box.getAttribute('data-resize-handles-pos')?.split(',').map(p => parseInt(p)))??initPos;
  const rect = box.getBoundingClientRect();
  let pos;
  if (box.classList.contains('box-h')) {
    pos = Math.round((e.clientX - rect.left) / rect.width * 1000);
  } else {
    pos = Math.round((e.clientY - rect.top) / rect.height * 1000);
  };
  pos = Math.min(1000, Math.max(0, pos));
  let beforeactiveHandle = true;
  const newPos = resizeHandles.map((h, i) => {
      console.log(pos, oldPos[i], initPos[i]);
      if (h === resizeHandle) {
          beforeactiveHandle = false;
          return pos;
      };
      if (beforeactiveHandle) {
          return Math.min(pos, Math.max(oldPos[i], initPos[i]));
      } else {
          return Math.max(pos, Math.min(oldPos[i], initPos[i]));
      };
  });
  console.log(newPos);
  setFlexFromPos(box, newPos);
};

function makeResizeHandle() {
  const resizeHandle = document.createElement('div');
  resizeHandle.className = "resize-handle";
  resizeHandle.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
    if (ev.button!=0) {return;};
    resizeHandle.classList.add('resize-handle-active');
    const box = resizeHandle.closest('.box');
    let initPos = box.getAttribute('data-resize-handles-pos');
    const resizeHandles = Array.from(box.querySelectorAll(':scope>.object>.resize-handle'));
    if (initPos) {
      console.log('has pos');
      initPos = initPos.split(',').map(p => parseInt(p));
    } else {
      const rhFlex = resizeHandles.map((h) => {
        const flex = h.closest('.object').style.flex;
        if (flex!= "") {
          return parseInt(flex);
        } else { return 1; };
      });
      const total = rhFlex.reduce((acc, curr) => acc + curr, 0)
      initPos = rhFlex.reduce((acc, curr) => {
        console.log(acc, curr)
        if (acc.length === 0) {
          acc.push(curr * 1000 / total);
        } else {
          acc.push( acc[acc.length - 1] + curr * 1000 / total );
        }
        return acc;
      }, []);
      console.log('no has pos', rhFlex, total, initPos);
    };
    console.log(initPos);
    const onMove = (e) => resize(e, resizeHandle, box, initPos, resizeHandles);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', (e) => {
      resizeHandle.classList.remove('resize-handle-active');
      document.removeEventListener('pointermove', onMove);
    }, {once: true});
  });
  return resizeHandle;
};

makeSortableTarget(document.getElementById('target'));

`
html, body {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background-color: #111111;
}

.box {
  flex: 1;
  display: flex;
  flex-direction: column;
  color: white;
  overflow: scroll;
}

.object {
  flex: 1;
  position: relative;
  display: flex;
}

.object-content {
  flex: 1;
  padding: 10px;
  border: 1px solid #FFFFFF55;
  display: flex;
}

.box-h {
  flex-direction: row;  
}

.box-v {
  flex-direction: column;  
}

.box-h > .object {
  flex-direction: row;  
}

.box-v > .object {
  flex-direction: column;  
}

.resize-handle {
  position: absolute;
  background-color: #00000000;
}

.resize-handle:hover,
.resize-handle-active {
  background-color: blue;
}

.box-h > .object > .resize-handle {
  width: 10px;
  top: 0;
  bottom: 0;
  right: 0;
  cursor: col-resize;
}

.box-v > .object > .resize-handle {
  right: 0;
  bottom: 0;
  left: 0;
  height: 10px;
  cursor: row-resize;
}

.box > .object:last-of-type > .resize-handle {
  display: none;
}

.move-handle::before {
  content: 'moveMe';
}

#source {
  flex: 1;
  gap: 10px;
  padding: 10px;
  border: 1px solid #FFFFFF55;
}

#trash {
  flex: 1;
  border: 1px solid #FFFFFF55;
}

#target {
  flex: 5;
  padding: 10px;
  border: 1px solid #FFFFFF55;
}

#target .sortable-ghost {
  pointer-events: none;
}

#trash .sortable-ghost {
  display: none;
}

.box:not(#source):has(.sortable-ghost) {
  margin: 0px;
  gap: 0px;
}

.box:not(#source):has(.sortable-ghost):not(:has(.box .sortable-ghost)) {
  border: 2px dashed blue;
}

.object .box-splitter {
  display: none;
}

.box:has(.sortable-ghost) .object .box-splitter {
  display: block;
  position: absolute;
  inset: min(50px, 25%);
  z-index: 999;
  /*top: 0;
  bottom: 0;
  left: 0;
  width: 50%;*/
}

.box-splitter .object {
  display: none !important;
}

.box-splitter-overlay {
  position: absolute;
  z-index: 999;
  background-color: #FFFFFF55;
}
`
`
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>

<div id='source', class='box'>
  <div class='object'>
    <div class='object-content'>Obj1</div>
  </div>
  <div class='object'>
    <div class='object-content'>Obj2</div>
  </div>
  <div class='object'>
    <div class='object-content'>Obj3</div>
  </div>
  <div class='object'>
    <div class='object-content'>Obj4</div>
  </div>
  <div class='object'>
    <div class='object-content'>Obj5</div>
  </div>
  <div class='object'>
    <div class='object-content'>Obj6</div>
  </div>
  <div class='object'>
    <div class='object-content'>Obj7</div>
  </div>
</div>

<div id='target', class='box box-v'></div>

<div id='trash', class='box box-trash'>Trash</div>`