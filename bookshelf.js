const initBookshelfUI = () => {
    const container = document.getElementById('bookshelf-module');
    if (!container) return;

    container.innerHTML = `
        <div class="glass-panel rounded-[2.5rem] overflow-hidden border-l-[12px] border-emerald-900">
            <div class="w-full p-6 pb-2 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="text-sm font-black text-slate-800 uppercase tracking-widest">📚 Data Bookshelf</span>
                    <span id="file-count-badge" class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">0 Files</span>
                </div>
                <button onclick="toggleBookshelf()" id="shelf-arrow" class="transition-transform duration-300 cursor-pointer p-2 hover:bg-slate-100 rounded-full outline-none">▼</button>
            </div>

            <div class="px-8 pb-4">
                <div class="flex flex-wrap items-center justify-start gap-2 pt-2 border-t border-slate-50">
                    <div id="company-tabs" class="flex flex-wrap gap-2 items-center">
                        <button class="category-btn bg-slate-100 text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase shadow-sm cursor-wait animate-pulse">Syncing Database...</button>
                    </div>
                    <button onclick="addNewCompany()" class="shrink-0 bg-slate-800 text-white w-7 h-7 flex items-center justify-center rounded-full text-lg font-bold hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer">+</button>
                </div>
            </div>
            
            <div id="shelf-content">
                <div class="px-8 pb-8 pt-2">
                    <div id="drop-zone" class="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2rem] p-8 mb-6 flex flex-col items-center justify-center transition-all group relative">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Profile: <span id="active-category-name" class="text-emerald-600 font-black">All</span></p>
                        <div class="text-center group-hover:scale-105 transition-transform pointer-events-none">
                            <div class="text-2xl mb-2 opacity-40">📥</div>
                            <p class="text-[10px] font-bold text-slate-500 uppercase mb-4">Drag files here or</p>
                        </div>
                        <label class="btn-primary text-white text-[10px] font-bold px-8 py-3 rounded-xl cursor-pointer uppercase tracking-widest shadow-md hover:scale-105 transition-transform active:scale-95 z-10">
                            Browse Files
                            <input type="file" id="file-upload" class="hidden" onchange="window.handleFileUpload(event)">
                        </label>
                    </div>
                    <div id="bookshelf-grid" class="flex flex-col gap-3"></div>
                </div>
            </div>
        </div>
    `;
    setupDragAndDrop();
    
    if (typeof updateTabUI === 'function') updateTabUI();
};

window.renderFileCards = (files) => {
    const grid = document.getElementById('bookshelf-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    files.forEach(file => {
        const parts = file.name.split('_');
        const categoryTag = parts[0] || 'Unknown';
        const displayName = parts.length > 2 ? parts.slice(2).join('_') : file.name;
        const colorClass = window.getCategoryColor(categoryTag);
        
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm relative group hover:border-emerald-300 transition-all";
        card.innerHTML = `
            <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="text-3xl opacity-80">📄</div>
                <div class="flex flex-col flex-1 min-w-0 text-left">
                    <div class="text-[12px] font-black text-slate-700 truncate w-full pr-4" title="${displayName}">${displayName}</div>
                    <div class="flex items-center mt-1.5">
                        <span class="px-2.5 py-0.5 ${colorClass} text-white text-[9px] font-black rounded uppercase tracking-widest shadow-sm">${categoryTag}</span>
                    </div>
                </div>
            </div>
            <button onclick="window.deleteFile('${file.name}')" class="shrink-0 ml-4 bg-slate-50 hover:bg-red-500 text-slate-400 hover:text-white w-9 h-9 rounded-full text-[12px] flex items-center justify-center transition-colors cursor-pointer shadow-sm border border-slate-100 group-hover:border-red-200" title="Delete File">✕</button>
        `;
        grid.appendChild(card);
    });
};

const setupDragAndDrop = () => {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, (evt) => { evt.preventDefault(); evt.stopPropagation(); }, false);
    });
    ['dragenter', 'dragover'].forEach(e => {
        dropZone.addEventListener(e, () => dropZone.classList.add('drag-over'), false);
    });
    ['dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, () => dropZone.classList.remove('drag-over'), false);
    });
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) window.handleFileUpload(files[0]); 
    });
};

document.addEventListener('DOMContentLoaded', initBookshelfUI);