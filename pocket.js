// --- MJM-AI POCKET MODULE ---

window.pocketSlots = [null, null, null, null, null, null];
let draggedSlotIndex = null; 

window.savePocketState = () => {
    localStorage.setItem('mjm_pocket_state', JSON.stringify(window.pocketSlots));
};

window.updateBaseScales = () => {
    document.querySelectorAll('.wysiwyg-container').forEach(container => {
        const canvasWidth = parseFloat(container.getAttribute('data-canvas-width')) || 400;
        const actualWidth = container.offsetWidth; 
        if (actualWidth > 0) {
            container.style.setProperty('--base-scale', actualWidth / canvasWidth);
        }
    });
};

const initPocket = async () => {
    if (document.getElementById('pocket-trigger')) return;

    const saved = localStorage.getItem('mjm_pocket_state');
    if(saved) {
        try { window.pocketSlots = JSON.parse(saved); } catch(e){}
    }

    const trigger = document.createElement('div');
    trigger.id = 'pocket-trigger';
    trigger.className = 'hidden fixed bottom-6 right-6 w-14 h-14 bg-emerald-900 text-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer z-[9999] hover:scale-110 transition-all border border-emerald-400 touch-none';
    
    trigger.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-0.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <div id="pocket-count" class="absolute -top-1 -right-1 bg-red-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">0</div>
    `;
    
    document.body.appendChild(trigger);

    // --- NEW: DRAGGABLE TRIGGER LOGIC ---
    let isDraggingTrigger = false;
    let triggerHasMoved = false;
    let dragStartX, dragStartY, initialLeft, initialTop;

    const startTriggerDrag = (e) => {
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        dragStartX = clientX;
        dragStartY = clientY;
        
        const rect = trigger.getBoundingClientRect();
        
        // Convert bottom/right positioning to top/left for smooth dragging math
        if (!trigger.style.top || !trigger.style.left) {
            trigger.style.top = rect.top + 'px';
            trigger.style.left = rect.left + 'px';
            trigger.style.bottom = 'auto';
            trigger.style.right = 'auto';
        }
        
        initialLeft = parseFloat(trigger.style.left);
        initialTop = parseFloat(trigger.style.top);
        
        isDraggingTrigger = true;
        triggerHasMoved = false;
        trigger.style.transition = 'none'; // Disable hover pop so it sticks to finger perfectly
    };

    const moveTriggerDrag = (e) => {
        if (!isDraggingTrigger) return;
        
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;
        
        // If moved more than 5px, it's a drag, not a click
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            triggerHasMoved = true;
            if (e.cancelable) e.preventDefault(); // Stop mobile screen from scrolling while dragging
        }
        
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        
        // Keep it safely within the screen bounds
        const triggerSize = 56; // 14rem = 56px
        if (newLeft < 10) newLeft = 10;
        if (newTop < 10) newTop = 10;
        if (newLeft > window.innerWidth - triggerSize - 10) newLeft = window.innerWidth - triggerSize - 10;
        if (newTop > window.innerHeight - triggerSize - 10) newTop = window.innerHeight - triggerSize - 10;
        
        trigger.style.left = newLeft + 'px';
        trigger.style.top = newTop + 'px';
    };

    const stopTriggerDrag = () => {
        if (!isDraggingTrigger) return;
        isDraggingTrigger = false;
        trigger.style.transition = 'all 0.3s ease'; // Restore smooth hover effects
    };

    // Mouse events
    trigger.addEventListener('mousedown', startTriggerDrag);
    document.addEventListener('mousemove', moveTriggerDrag, { passive: false });
    document.addEventListener('mouseup', stopTriggerDrag);

    // Touch events for Phone/iPad
    trigger.addEventListener('touchstart', startTriggerDrag, { passive: false });
    document.addEventListener('touchmove', moveTriggerDrag, { passive: false });
    document.addEventListener('touchend', stopTriggerDrag);

    // Smart Click: Only toggle the pocket if the user didn't just drag it
    trigger.onclick = (e) => {
        if (triggerHasMoved) {
            e.preventDefault();
            triggerHasMoved = false;
            return;
        }
        window.togglePocket();
    };
    // -------------------------------------

    if (window._supabase) {
        const { data } = await window._supabase.auth.getSession();
        if (data?.session) trigger.classList.remove('hidden');
    }

    const panel = document.createElement('div');
    panel.id = 'pocket-panel';
    panel.className = 'fixed bottom-24 right-6 w-[450px] max-h-[75vh] min-w-[350px] min-h-[400px] bg-white rounded-[2rem] shadow-2xl border border-slate-200 z-[9999] flex flex-col hidden transition-all duration-300 overflow-hidden';
    
    panel.innerHTML = `
        <div id="tl-resize" class="absolute top-0 left-0 w-8 h-8 cursor-nwse-resize z-[10000] bg-indigo-500/80 backdrop-blur-md rounded-br-full opacity-0 hover:opacity-100 transition-opacity flex items-start justify-start pt-1 pl-1" title="Drag to resize window" onmousedown="window.startResize(event)">
            <span class="text-white text-[10px] transform -rotate-45 block leading-none">↔</span>
        </div>

        <div class="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-default pl-10">
            <h3 class="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                Reports Pocket
            </h3>
            <div class="flex items-center gap-4">
                <button onclick="window.togglePocketFullscreen()" class="text-slate-400 hover:text-emerald-600 transition-colors" title="Enter Focus Mode">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                </button>
                <button onclick="window.togglePocket()" class="text-slate-400 hover:text-red-500 text-xl font-black cursor-pointer transition-colors">&times;</button>
            </div>
        </div>
        <div id="pocket-instruction" class="bg-indigo-50 px-4 py-2 text-[9px] text-indigo-700 font-bold uppercase tracking-widest flex justify-between items-center border-b border-indigo-100 pl-10">
            <span>Drag items to sequence report</span>
            <button onclick="window.addPocketRow()" class="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded shadow-sm hover:bg-indigo-300 transition-colors cursor-pointer">+ Add Row</button>
        </div>
        <div id="pocket-grid" class="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
        </div>
        
        <div class="p-4 bg-white border-t border-slate-100 flex gap-2 z-10">
            <button onclick="window.clearEntirePocket()" class="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors cursor-pointer shadow-sm border border-red-100">Clear</button>
            <button id="btn-preview" onclick="window.generatePDF('preview')" class="bg-indigo-100 text-indigo-800 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-200 transition-colors cursor-pointer shadow-sm">Preview PDF</button>
            <button id="btn-download" onclick="window.generatePDF('download')" class="flex-1 bg-emerald-900 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors cursor-pointer shadow-md">Download PDF</button>
        </div>
    `;
    document.body.appendChild(panel);
    window.updatePocketUI();

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
            if (window.updateBaseScales) window.updateBaseScales();
        });
        ro.observe(panel);
    }

    document.addEventListener('mousedown', (e) => {
        const pocketPanel = document.getElementById('pocket-panel');
        const pocketTrigger = document.getElementById('pocket-trigger');
        if (isResizing) return;
        if (pocketPanel && !pocketPanel.classList.contains('hidden')) {
            if (!pocketPanel.contains(e.target) && 
                !pocketTrigger.contains(e.target) && 
                !e.target.closest('button[onclick*="saveVisualToPocket"]')) {
                pocketPanel.classList.add('hidden');
            }
        }
    });
};

window.togglePocket = () => {
    const panel = document.getElementById('pocket-panel');
    if (panel) panel.classList.toggle('hidden');
    if (window.updateBaseScales) setTimeout(window.updateBaseScales, 50);
};

let isResizing = false;
let startW, startH, startX, startY;

window.startResize = (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const panel = document.getElementById('pocket-panel');
    startW = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
    startH = parseInt(document.defaultView.getComputedStyle(panel).height, 10);
    document.addEventListener('mousemove', window.doResize);
    document.addEventListener('mouseup', window.stopResize);
    e.preventDefault();
};
window.doResize = (e) => {
    if (!isResizing) return;
    const panel = document.getElementById('pocket-panel');
    panel.style.width = (startW + (startX - e.clientX)) + 'px';
    panel.style.height = (startH + (startY - e.clientY)) + 'px';
};
window.stopResize = () => {
    isResizing = false;
    document.removeEventListener('mousemove', window.doResize);
    document.removeEventListener('mouseup', window.stopResize);
};

window.togglePocketFullscreen = () => {
    const panel = document.getElementById('pocket-panel');
    const resizeHandle = document.getElementById('tl-resize');
    const isFullscreen = panel.classList.contains('fullscreen-mode');

    if (isFullscreen) {
        panel.classList.remove('fullscreen-mode', 'inset-4', 'w-[calc(100%-2rem)]', 'h-[calc(100%-2rem)]', 'z-[99999]');
        panel.classList.add('bottom-24', 'right-6', 'w-[450px]', 'max-h-[75vh]', 'rounded-[2rem]');
        resizeHandle.style.display = 'flex';
    } else {
        panel.classList.add('fullscreen-mode', 'inset-4', 'w-[calc(100%-2rem)]', 'h-[calc(100%-2rem)]', 'z-[99999]');
        panel.classList.remove('bottom-24', 'right-6', 'w-[450px]', 'max-h-[75vh]', 'rounded-[2rem]');
        panel.classList.add('rounded-3xl');
        panel.style.width = ''; panel.style.height = ''; 
        resizeHandle.style.display = 'none';
    }
};

window.addPocketRow = () => {
    window.pocketSlots.push(null, null); 
    window.updatePocketUI();
};

window.removeSlot = (index) => {
    window.pocketSlots.splice(index, 1);
    window.updatePocketUI();
};

window.clearSlot = (index) => {
    window.pocketSlots[index] = null;
    window.updatePocketUI();
};

window.clearEntirePocket = () => {
    if(confirm("Are you sure you want to completely erase the reports pocket? This cannot be undone.")) {
        window.pocketSlots = [null, null, null, null, null, null];
        window.updatePocketUI();
    }
};

window.saveVisualToPocket = (btn) => {
    const container = btn.closest('.ai-visual-container');
    const visualContent = container.querySelector('.visual-content-core').innerHTML;

    let emptyIdx = window.pocketSlots.findIndex(s => s === null);
    if (emptyIdx === -1) {
        emptyIdx = window.pocketSlots.length;
        window.pocketSlots.push(null, null);
    }

    window.pocketSlots[emptyIdx] = { 
        id: 'pk-' + Date.now(), 
        type: 'visual', 
        content: visualContent,
        scale: 1, x: 0, y: 0, 
        colSpan: 1 
    };
    window.updatePocketUI();
    
    const trigger = document.getElementById('pocket-trigger');
    if (trigger) {
        trigger.classList.add('bg-indigo-500', 'scale-125');
        setTimeout(() => trigger.classList.remove('bg-indigo-500', 'scale-125'), 400);
    }
};

window.handleManualUpload = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const imgTag = `<img src="${evt.target.result}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px;">`;
        window.pocketSlots[index] = { 
            id: 'man-' + Date.now(), type: 'image', content: imgTag, scale: 1, x: 0, y: 0, colSpan: 1 
        };
        window.updatePocketUI();
    };
    reader.readAsDataURL(file);
};

window.turnSlotIntoNote = (index) => {
    window.pocketSlots[index] = { id: 'note-' + Date.now(), type: 'note', content: '', colSpan: 1 };
    window.updatePocketUI();
};

window.updateNoteContent = (index, value) => {
    if (window.pocketSlots[index] && window.pocketSlots[index].type === 'note') {
        window.pocketSlots[index].content = value;
        window.savePocketState();
    }
};

window.adjustSlot = (index, action, value) => {
    if (!window.pocketSlots[index]) return;
    let slot = window.pocketSlots[index];
    slot.scale = slot.scale || 1;
    slot.x = slot.x || 0;
    slot.y = slot.y || 0;

    if (action === 'zoom') slot.scale += value;
    if (action === 'moveX') slot.x += value;
    if (action === 'moveY') slot.y += value;
    
    if (slot.scale < 0.2) slot.scale = 0.2; 
    window.updatePocketUI();
};

window.adjustSlotReset = (index) => {
    if (!window.pocketSlots[index]) return;
    window.pocketSlots[index].scale = 1;
    window.pocketSlots[index].x = 0;
    window.pocketSlots[index].y = 0;
    window.updatePocketUI();
};

window.toggleSlotWidth = (index) => {
    if (!window.pocketSlots[index]) return;
    window.pocketSlots[index].colSpan = window.pocketSlots[index].colSpan === 2 ? 1 : 2;
    window.updatePocketUI();
};

window.updatePocketUI = () => {
    const grid = document.getElementById('pocket-grid');
    const countBadge = document.getElementById('pocket-count');
    
    const filledCount = window.pocketSlots.filter(s => s !== null).length;
    if (countBadge) countBadge.innerText = filledCount;
    
    if (grid) {
        grid.innerHTML = '';
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid grid-cols-2 gap-3';

        window.pocketSlots.forEach((slot, index) => {
            const block = document.createElement('div');
            
            const isFullWidth = slot && slot.colSpan === 2;
            const colClass = isFullWidth ? 'col-span-2' : 'col-span-1';
            const aspectStyle = isFullWidth ? 'aspect-ratio: 2.75 / 1;' : 'aspect-ratio: 4 / 3;';
            const canvasWidth = isFullWidth ? 1600 : 800; 
            const canvasHeight = isFullWidth ? 582 : 600;
            
            if (slot === null) {
                block.className = `relative bg-slate-300/20 backdrop-blur-sm border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center group transition-all w-full ${colClass}`;
                block.style.cssText = aspectStyle;
                block.dataset.index = index;
                block.addEventListener('dragover', handleDragOver);
                block.addEventListener('drop', handleDrop);
                block.addEventListener('dragenter', handleDragEnter);
                block.addEventListener('dragleave', handleDragLeave);

                block.innerHTML = `
                    <span class="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Block ${index + 1}</span>
                    <button onclick="window.removeSlot(${index})" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] z-20 cursor-pointer shadow-sm transition-opacity" title="Delete Excess Block">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                    
                    <div class="absolute inset-0 cursor-default flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/80 rounded-2xl backdrop-blur-sm z-10 gap-2">
                        <div class="flex gap-4">
                            <label class="cursor-pointer flex flex-col items-center justify-center p-2 hover:bg-slate-700 rounded-xl transition-colors">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white mb-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                <span class="text-white text-[8px] font-bold uppercase tracking-widest">Image</span>
                                <input type="file" class="hidden" accept="image/*" onchange="window.handleManualUpload(event, ${index})">
                            </label>
                            <button onclick="window.turnSlotIntoNote(${index})" class="cursor-pointer flex flex-col items-center justify-center p-2 hover:bg-slate-700 rounded-xl transition-colors outline-none">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white mb-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                <span class="text-white text-[8px] font-bold uppercase tracking-widest">Note</span>
                            </button>
                        </div>
                    </div>
                `;
            } else if (slot.type === 'note') {
                block.className = `relative bg-yellow-50/80 border border-yellow-200 rounded-2xl flex flex-col group cursor-move shadow-sm overflow-hidden hover:border-yellow-400 transition-all p-3 w-full ${colClass}`;
                block.style.cssText = aspectStyle;
                block.draggable = true;
                block.dataset.index = index;
                block.addEventListener('dragstart', handleDragStart);
                block.addEventListener('dragover', handleDragOver);
                block.addEventListener('drop', handleDrop);
                block.addEventListener('dragenter', handleDragEnter);
                block.addEventListener('dragleave', handleDragLeave);

                block.innerHTML = `
                    <div class="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onclick="window.toggleSlotWidth(${index})" class="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-indigo-600 transition-colors cursor-pointer" title="Toggle Width">↔</button>
                    </div>
                    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onclick="window.clearSlot(${index})" class="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-red-600 transition-colors cursor-pointer" title="Delete Content">✕</button>
                    </div>
                    <textarea class="w-full h-full bg-transparent border-none outline-none resize-none text-slate-700 text-xs custom-scrollbar z-0" placeholder="Type your observation notes here..." oninput="window.updateNoteContent(${index}, this.value)">${slot.content}</textarea>
                    <div class="absolute bottom-0 left-0 w-full bg-yellow-200/80 text-yellow-800 text-[8px] font-bold text-center py-1 uppercase tracking-widest pointer-events-none">
                        Note Block: ${index + 1}
                    </div>
                `;
            } else {
                block.className = `relative bg-white border border-slate-200 rounded-2xl flex items-center justify-center group shadow-sm overflow-hidden hover:border-indigo-400 transition-all w-full ${colClass}`;
                block.style.cssText = aspectStyle;
                block.draggable = true;
                block.dataset.index = index;
                block.addEventListener('dragstart', handleDragStart);
                block.addEventListener('dragover', handleDragOver);
                block.addEventListener('drop', handleDrop);
                block.addEventListener('dragenter', handleDragEnter);
                block.addEventListener('dragleave', handleDragLeave);

                const scale = slot.scale || 1;
                const x = slot.x || 0;
                const y = slot.y || 0;

                block.innerHTML = `
                    <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col gap-1 bg-white/95 p-1.5 rounded-xl shadow-lg border border-slate-200 backdrop-blur-sm cursor-default" ondragstart="event.preventDefault(); event.stopPropagation();">
                        <div class="text-[8px] font-black text-slate-400 text-center uppercase tracking-widest mb-1 border-b border-slate-100 pb-1">Adjust Fit</div>
                        <div class="flex gap-1 justify-center">
                            <button onclick="window.adjustSlot(${index}, 'zoom', 0.1)" class="bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-[14px] font-bold transition-colors">＋</button>
                            <button onclick="window.adjustSlot(${index}, 'zoom', -0.1)" class="bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-[14px] font-bold transition-colors">－</button>
                        </div>
                        <div class="flex gap-1 justify-center mt-1">
                            <button onclick="window.adjustSlot(${index}, 'moveY', -15)" class="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors">▲</button>
                        </div>
                        <div class="flex gap-1 justify-center">
                            <button onclick="window.adjustSlot(${index}, 'moveX', -15)" class="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors">◀</button>
                            <button onclick="window.adjustSlot(${index}, 'moveY', 15)" class="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors">▼</button>
                            <button onclick="window.adjustSlot(${index}, 'moveX', 15)" class="bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors">▶</button>
                        </div>
                        <button onclick="window.toggleSlotWidth(${index})" class="bg-slate-200 hover:bg-slate-300 text-slate-600 w-full h-5 mt-1 rounded flex items-center justify-center text-[9px] uppercase tracking-widest font-bold transition-colors" title="Change to Full/Half Width">↔ Toggle Width</button>
                        <button onclick="window.adjustSlotReset(${index})" class="bg-slate-200 hover:bg-slate-300 text-slate-600 w-full h-5 mt-1 rounded flex items-center justify-center text-[9px] uppercase tracking-widest font-bold transition-colors">Reset</button>
                    </div>

                    <div class="wysiwyg-container w-full h-full flex items-center justify-center overflow-hidden cursor-move" data-canvas-width="${canvasWidth}">
                        <div style="transform: scale(var(--base-scale, 1)); display: flex; align-items: center; justify-content: center; pointer-events: none;">
                            <div style="width: ${canvasWidth}px; height: ${canvasHeight}px; transform-origin: center; transform: scale(${scale}) translate(${x}px, ${y}px); transition: transform 0.2s; display: flex; align-items: center; justify-content: center;">
                                ${slot.content}
                            </div>
                        </div>
                    </div>
                    
                    <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onclick="window.clearSlot(${index})" class="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-red-600 transition-colors cursor-pointer">✕</button>
                    </div>
                    <div class="absolute bottom-0 w-full bg-slate-800/80 text-white text-[8px] font-bold text-center py-1 uppercase tracking-widest pointer-events-none">
                        Block: ${index + 1}
                    </div>
                `;
            }
            gridContainer.appendChild(block);
        });
        
        grid.appendChild(gridContainer);
        window.savePocketState(); 
        
        requestAnimationFrame(() => {
            if (window.updateBaseScales) window.updateBaseScales();
        });
    }
};

function handleDragStart(e) {
    if(e.target.tagName === 'BUTTON') { e.preventDefault(); return; } 
    draggedSlotIndex = parseInt(this.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => this.classList.add('opacity-40', 'scale-95'), 0);
}
function handleDragOver(e) {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
    return false;
}
function handleDragEnter(e) {
    this.classList.add('border-indigo-500', 'bg-indigo-50'); 
}
function handleDragLeave(e) {
    this.classList.remove('border-indigo-500', 'bg-indigo-50');
}
function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('border-indigo-500', 'bg-indigo-50', 'opacity-40', 'scale-95');
    
    const targetIndex = parseInt(this.dataset.index);

    if (draggedSlotIndex !== null && draggedSlotIndex !== targetIndex) {
        const temp = window.pocketSlots[targetIndex];
        window.pocketSlots[targetIndex] = window.pocketSlots[draggedSlotIndex];
        window.pocketSlots[draggedSlotIndex] = temp;
        
        window.updatePocketUI();
    }
    draggedSlotIndex = null;
    return false;
}

window.generatePDF = function(action) {
    if (window.pocketSlots.every(s => s === null)) {
        alert("Pocket is empty.");
        return;
    }

    const btn = action === 'download' ? document.getElementById('btn-download') : document.getElementById('btn-preview');
    if (btn) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = "GENERATING...";
        btn.disabled = true;
    }

    const overlay = document.createElement('div');
    overlay.id = 'pdf-export-overlay';
    overlay.className = 'fixed inset-0 bg-slate-900/95 z-[999999] flex flex-col items-center justify-center';
    
    const loader = document.createElement('div');
    loader.className = 'text-white font-black text-xl mb-6 tracking-widest uppercase animate-pulse';
    loader.innerText = '📸 Generating Standard PDF...';
    overlay.appendChild(loader);
    document.body.appendChild(overlay);

    const tempDiv = document.createElement('div');
    tempDiv.id = 'pdf-export-container';
    tempDiv.style.position = 'absolute';
    tempDiv.style.top = '0px'; 
    tempDiv.style.left = '0px';
    tempDiv.style.width = '1024px'; 
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.padding = '40px';
    tempDiv.style.boxSizing = 'border-box';
    tempDiv.style.zIndex = '999998'; 
    tempDiv.className = 'font-sans text-slate-800'; 

    const content = window.pocketSlots.map((slot, idx) => {
        const isFullWidth = slot && slot.colSpan === 2;
        const boxWidth = isFullWidth ? 944 : 460; 
        const boxHeight = isFullWidth ? (944 / 2.75) : (460 * 3 / 4); 
        const canvasWidth = isFullWidth ? 1600 : 800; 
        const printBaseScale = boxWidth / canvasWidth;

        if (slot === null) {
            return `
            <div style="width: ${boxWidth}px; height: ${boxHeight}px; margin-bottom: 24px;" class="border-2 border-dashed border-slate-300 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-6 bg-slate-50">
                <span class="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Empty / Notes Space</span>
            </div>`;
        } else if (slot.type === 'note') {
            return `
            <div style="width: ${boxWidth}px; height: ${boxHeight}px; margin-bottom: 24px;" class="bg-yellow-50 border border-yellow-200 rounded-3xl overflow-hidden shadow-sm flex flex-col p-6">
                <h3 class="w-full text-left text-[9px] font-black text-yellow-700 uppercase tracking-[0.2em] mb-4 border-b border-yellow-200 pb-2 flex items-center gap-2">
                    <span class="bg-yellow-200 text-yellow-900 px-2 py-1 rounded-md">Block ${idx + 1}</span> 
                    Analyst Notes
                </h3>
                <div class="flex-1 overflow-hidden text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">${slot.content || '<i class="text-slate-400">No notes written...</i>'}</div>
            </div>`;
        } else {
            const scale = slot.scale || 1;
            const x = slot.x || 0;
            const y = slot.y || 0;
            
            return `
            <div style="width: ${boxWidth}px; height: ${boxHeight}px; margin-bottom: 24px; position: relative; overflow: hidden;" class="bg-white border border-slate-200 rounded-3xl shadow-sm">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(${printBaseScale}); display: flex; align-items: center; justify-content: center;">
                    <div style="width: ${canvasWidth}px; transform-origin: center; transform: scale(${scale}) translate(${x}px, ${y}px); display: flex; align-items: center; justify-content: center;">
                        ${slot.content}
                    </div>
                </div>
            </div>`;
        }
    }).join('');

    tempDiv.innerHTML = `
        <div class="border-b-4 border-emerald-900 pb-6 mb-8 flex justify-between items-end">
            <div>
                <div class="flex items-center font-black text-4xl text-[#1b4332] tracking-tight">
                    <span class="italic">MJM</span>
                    <div class="ml-3 relative group">
                        <span class="relative px-3 py-1 text-[16px] bg-emerald-500 text-white rounded border border-emerald-300 uppercase tracking-[0.3em] font-bold shadow-md flex items-center gap-1.5">
                            AI
                        </span>
                    </div>
                </div>
                <div class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-3">Operations Analysis Report</div>
            </div>
            <div class="text-right text-[10px] font-bold text-slate-400 uppercase">
                <span class="block mb-1">Generated: ${new Date().toLocaleDateString()}</span>
            </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; width: 100%;">
            ${content}
        </div>
    `;

    document.body.appendChild(tempDiv);

    setTimeout(() => {
        if (typeof html2pdf === 'undefined') {
            alert("PDF Engine is still loading. Please check internet connection or wait a second.");
            document.body.removeChild(overlay);
            document.body.removeChild(tempDiv);
            if (btn) { btn.innerText = btn.dataset.originalText; btn.disabled = false; }
            return;
        }

        const opt = {
            margin:       15, 
            filename:     `MJM_AI_Report_${Date.now()}.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 2, useCORS: true, windowWidth: 1024, scrollY: 0, scrollX: 0 }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const elementToCapture = document.getElementById('pdf-export-container');

        if (action === 'download') {
            html2pdf().set(opt).from(elementToCapture).save().then(() => {
                document.body.removeChild(overlay);
                document.body.removeChild(tempDiv);
                if (btn) { btn.innerText = btn.dataset.originalText; btn.disabled = false; }
            });
        } else {
            html2pdf().set(opt).from(elementToCapture).outputPdf('bloburl').then(url => {
                window.open(url, '_blank');
                document.body.removeChild(overlay);
                document.body.removeChild(tempDiv);
                if (btn) { btn.innerText = btn.dataset.originalText; btn.disabled = false; }
            });
        }
    }, 800); 
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPocket);
} else {
    initPocket();
}
