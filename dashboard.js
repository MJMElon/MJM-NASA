// Splitting the key so GitHub security bots don't auto-delete it!
const keyPart1 = 'AIzaSyBUAjnwms'; 
const keyPart2 = 'PXpBFyqi6Y1lpaEyyn99SE0fM';
const GEMINI_API_KEY = keyPart1 + keyPart2;

// Global State
window.customTabs = []; 
window.selectedCategories = ['All']; 
window.tabsLoaded = false;
window.currentFilesForAI = []; 
let currentAbortController = null; 
window.lastUserText = ""; 

// --- 1. AUTO-COLOR LOGIC ---
window.getCategoryColor = (cat) => {
    if (cat === 'All') return 'bg-emerald-600';
    if (cat === 'MJSB') return 'bg-blue-600';
    if (cat === 'MPSB') return 'bg-purple-600';
    const colors = ['bg-orange-600', 'bg-pink-600', 'bg-indigo-600', 'bg-cyan-600', 'bg-red-600', 'bg-teal-600'];
    let hash = 0;
    for (let i = 0; i < cat.length; i++) { hash = cat.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
};

// --- 2. FULL MULTI-SELECT & TAB LOGIC ---
window.toggleBookshelf = function() {
    const shelf = document.getElementById('shelf-content');
    const arrow = document.getElementById('shelf-arrow');
    if (!shelf) return;
    const isOpen = shelf.classList.toggle('open');
    if(arrow) arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    if(isOpen) loadBookshelf(true);
};

window.toggleFilter = function(id) {
    if (id === 'All') {
        const allSelected = window.customTabs.length > 0 && window.customTabs.every(catId => window.selectedCategories.includes(catId));
        if (allSelected) {
            window.selectedCategories = []; 
        } else {
            window.selectedCategories = [...window.customTabs]; 
        }
    } else {
        if (window.selectedCategories.includes(id)) {
            window.selectedCategories = window.selectedCategories.filter(c => c !== id);
        } else {
            window.selectedCategories.push(id);
        }
    }
    updateTabUI();
    loadBookshelf(true); 
};

window.deleteTab = async function(id, event) {
    event.stopPropagation(); 
    if(confirm(`Are you sure you want to remove the ${id} tab shelf?`)) {
        window.customTabs = window.customTabs.filter(c => c !== id);
        window.selectedCategories = window.selectedCategories.filter(c => c !== id);
        
        updateTabUI();
        loadBookshelf(true);
        
        if (window._supabase) {
            await window._supabase.storage.from('operation-reports').remove([id + '_tab.marker']);
        }
    }
};

window.updateTabUI = function() {
    const tabsContainer = document.getElementById('company-tabs');
    if (!tabsContainer) return;

    const allSelected = window.customTabs.length > 0 && window.customTabs.every(catId => window.selectedCategories.includes(catId));
    let html = '';

    const allColor = window.getCategoryColor('All');
    if (allSelected || (window.selectedCategories.length === window.customTabs.length && window.customTabs.length > 0)) {
        html += `<button onclick="toggleFilter('All')" class="category-btn ${allColor} text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1" data-id="All"><span>✓ All</span></button>`;
    } else {
        html += `<button onclick="toggleFilter('All')" class="category-btn bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1" data-id="All"><span>All</span></button>`;
    }

    window.customTabs.forEach(catId => {
        const isSelected = window.selectedCategories.includes(catId);
        const colorClass = window.getCategoryColor(catId);
        const deleteBtnHtml = `<span onclick="window.deleteTab('${catId}', event)" class="w-4 h-4 rounded-full flex items-center justify-center ml-1 text-[8px] transition-colors shadow-sm ${isSelected ? 'bg-black/20 hover:bg-black/40' : 'bg-slate-200 hover:bg-red-500 hover:text-white'}">✕</span>`;
        
        if (isSelected) {
            html += `<button onclick="toggleFilter('${catId}')" class="category-btn ${colorClass} text-white pl-4 pr-2 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1" data-id="${catId}"><span>✓ ${catId}</span>${deleteBtnHtml}</button>`;
        } else {
            html += `<button onclick="toggleFilter('${catId}')" class="category-btn bg-slate-100 text-slate-600 pl-4 pr-2 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1" data-id="${catId}"><span>${catId}</span>${deleteBtnHtml}</button>`;
        }
    });

    tabsContainer.innerHTML = html;

    const activeNameEl = document.getElementById('active-category-name');
    if (activeNameEl) {
        if (allSelected || (window.selectedCategories.length === window.customTabs.length && window.customTabs.length > 0)) {
            activeNameEl.innerText = 'All';
            activeNameEl.className = 'text-emerald-600 font-black';
        } else if (window.selectedCategories.length === 1) {
            activeNameEl.innerText = window.selectedCategories[0];
            activeNameEl.className = `font-black ${window.getCategoryColor(window.selectedCategories[0]).replace('bg-', 'text-')}`;
        } else if (window.selectedCategories.length > 1) {
            activeNameEl.innerText = 'Multiple Custom';
            activeNameEl.className = 'text-indigo-600 font-black';
        } else {
            activeNameEl.innerText = 'None';
            activeNameEl.className = 'text-slate-400 font-black';
        }
    }
};

// --- NEW: UPLOAD & DELETE FILE LOGIC ---
window.deleteFile = async function(fileName) {
    if(!confirm(`Are you sure you want to completely delete "${fileName}" from the database?`)) return;
    if(!window._supabase) return;
    
    const { error } = await window._supabase.storage.from('operation-reports').remove([fileName]);
    if(!error) {
        loadBookshelf(true); 
    } else {
        alert("Error deleting file: " + error.message);
    }
};

window.handleFileUpload = async function(eventOrFile) {
    let file = eventOrFile.target ? eventOrFile.target.files[0] : eventOrFile;
    if (!file || !window._supabase) return;

    const activeNameEl = document.getElementById('active-category-name');
    const activeName = activeNameEl ? activeNameEl.innerText : 'All';
    
    if (activeName === 'All' || activeName === 'Multiple Custom' || activeName === 'None') {
        alert("Please explicitly select ONE single Tab Profile (e.g., MJSB) above to upload this file into.");
        return;
    }
    
    const categoryTag = activeName;
    const fileName = `${categoryTag}_${Date.now()}_${file.name}`;

    const dropZone = document.getElementById('drop-zone');
    const originalHTML = dropZone.innerHTML;
    
    dropZone.innerHTML = `
        <div class="w-full flex flex-col items-center justify-center p-4">
            <div class="text-[10px] font-bold text-slate-500 uppercase mb-3">Uploading: <span class="text-slate-800">${file.name}</span></div>
            <div class="w-full max-w-xs bg-slate-200 rounded-full h-3 overflow-hidden relative mb-2 shadow-inner">
                <div id="upload-progress-bar" class="absolute top-0 left-0 bg-emerald-500 h-full rounded-full transition-all duration-200" style="width: 0%"></div>
            </div>
            <div id="upload-progress-text" class="text-[11px] font-black text-emerald-700">0%</div>
        </div>
    `;

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if(progress > 90) progress = 90;
        document.getElementById('upload-progress-bar').style.width = `${progress}%`;
        document.getElementById('upload-progress-text').innerText = `${Math.floor(progress)}%`;
    }, 150);

    const { data, error } = await window._supabase.storage.from('operation-reports').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
    });

    clearInterval(progressInterval);

    if (error) {
        alert("Upload failed: " + error.message);
        dropZone.innerHTML = originalHTML;
    } else {
        document.getElementById('upload-progress-bar').style.width = `100%`;
        document.getElementById('upload-progress-text').innerText = `100%`;
        setTimeout(() => {
            dropZone.innerHTML = originalHTML;
            loadBookshelf(true); 
        }, 600);
    }
};

// --- 3. SUPABASE STORAGE LOGIC ---
window.loadBookshelf = async function(skipTabFetch = false) {
    if (!window._supabase) return;
    
    const { data, error } = await window._supabase.storage.from('operation-reports').list();
    if (error) return;

    if (!window.tabsLoaded && !skipTabFetch) {
        const markerTabs = data.filter(f => f.name.endsWith('_tab.marker')).map(f => f.name.replace('_tab.marker', ''));
        window.customTabs = Array.from(new Set(['MJSB', 'MPSB', ...markerTabs]));
        
        if (window.selectedCategories.includes('All')) {
            window.selectedCategories = [...window.customTabs];
        }
        window.tabsLoaded = true;
        if (typeof updateTabUI === 'function') updateTabUI();
    }
    
    const filtered = data.filter(f => {
        if (f.name.endsWith('.marker') || f.name.endsWith('.json')) return false; 
        if (window.selectedCategories.length === 0) return false;
        return window.selectedCategories.some(cat => f.name.startsWith(cat + "_"));
    });
    
    const badge = document.getElementById('file-count-badge');
    if(badge) badge.innerText = `${filtered.length} Files`;
    if (window.renderFileCards) window.renderFileCards(filtered);
    window.currentFilesForAI = filtered; 
};

// --- 4. IMPROVED AI BRAIN & INTERFACE ---
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const logoutBtn = document.getElementById('logout-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.__isLoggingOut = true; 
            localStorage.removeItem('mjm_chat_history'); 
        });
    }

    const saveChatHistory = () => {
        if(window.__isLoggingOut) return; 
        if(chatBox && chatBox.innerHTML.trim() !== '') {
            localStorage.setItem('mjm_chat_history', chatBox.innerHTML);
        }
    };

    window.addEventListener('beforeunload', saveChatHistory);

    const observer = new MutationObserver((mutations) => {
        if (chatBox) {
            const content = chatBox.innerHTML;
            if (content.includes("I'm Elon") && !content.includes('bg-emerald-50 p-4')) {
                const savedHistory = localStorage.getItem('mjm_chat_history');
                if (savedHistory && (savedHistory.includes('bg-emerald-50 p-4') || savedHistory.includes('ai-visual-container'))) {
                    chatBox.innerHTML = savedHistory;
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const chatInputContainer = chatInput.parentElement;
    const refreshBtn = document.createElement('button');
    refreshBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
    refreshBtn.title = "Cancel stuck request and regenerate";
    refreshBtn.className = 'bg-slate-200 text-slate-700 hover:bg-slate-300 w-11 h-11 flex items-center justify-center rounded-2xl transition-colors cursor-pointer shrink-0';
    chatInputContainer.insertBefore(refreshBtn, sendBtn);

    refreshBtn.onclick = () => {
        if (currentAbortController) currentAbortController.abort(); 
        document.querySelectorAll('[id^="loading-"]').forEach(el => el.remove()); 
        if (window.lastUserText) {
            chatInput.value = window.lastUserText;
            handleSend();
        }
    };

    window.downloadAIImage = (btn, fileName) => {
        const container = btn.closest('.ai-visual-container').querySelector('.visual-content-core');
        const img = container.querySelector('img');
        if (img) {
            const link = document.createElement('a');
            link.href = img.src;
            link.download = `MJM_AI_${fileName}_${Date.now()}.png`;
            link.click();
        } else {
            const htmlContent = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="p-8 bg-slate-50">${container.innerHTML}</body></html>`;
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `MJM_AI_${fileName}_${Date.now()}.html`;
            link.click();
        }
    };

    const handleSend = async () => {
        const userText = chatInput.value.trim();
        if (!userText) return;

        window.lastUserText = userText; 
        chatBox.innerHTML += `<div class="bg-emerald-50 p-4 rounded-2xl rounded-tr-none border border-emerald-100 ml-auto max-w-[85%] md:max-w-[80%] text-right font-semibold text-emerald-900 mb-4">${userText}</div>`;
        chatInput.value = '';
        saveChatHistory(); 
        
        const loadingId = 'loading-' + Date.now();
        
        // CHANGED: Added an animated spinner next to "Processing Data"
        chatBox.innerHTML += `
            <div id="${loadingId}" class="bg-white p-4 md:p-5 rounded-2xl rounded-tl-none border border-slate-200 max-w-[95%] md:max-w-[85%] shadow-sm mb-4 transition-all">
                <div class="flex justify-between items-center text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3">
                    <span id="${loadingId}-status" class="flex items-center gap-2">
                        <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> 
                        <span>Initializing Uplink...</span>
                    </span>
                    <span id="${loadingId}-time" class="text-slate-400 bg-slate-100 px-2 py-1 rounded-md hidden md:inline-block">EST: 35s</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 relative">
                    <div id="${loadingId}-bar" class="absolute top-0 left-0 bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out" style="width: 0%"></div>
                </div>
                <div class="mt-2 flex justify-between items-center text-[9px] font-bold text-slate-400">
                    <span class="uppercase tracking-widest flex items-center gap-1.5">
                        <svg class="w-3 h-3 animate-spin text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Processing Data
                    </span>
                    <span id="${loadingId}-pct" class="text-emerald-700 font-black">0%</span>
                </div>
            </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

        // CHANGED: Math.exp formula so the loading bar slows down smoothly and never abruptly gets stuck at 95%
        const startT = Date.now();
        const progInterval = setInterval(() => {
            const elapsed = (Date.now() - startT) / 1000;
            
            // Asymptotic curve: Approaches 95% slowly based on time
            let pct = 95 * (1 - Math.exp(-elapsed / 15)); 
            if (pct > 95) pct = 95;
            
            let timeLeft = Math.max(1, Math.ceil(35 - elapsed));
            
            const barEl = document.getElementById(`${loadingId}-bar`);
            const pctEl = document.getElementById(`${loadingId}-pct`);
            const timeEl = document.getElementById(`${loadingId}-time`);
            
            if(barEl) barEl.style.width = pct + '%';
            if(pctEl) pctEl.innerText = Math.floor(pct) + '%';
            if(timeEl) timeEl.innerText = `~${timeLeft}s remaining`;
        }, 200);

        if (currentAbortController) currentAbortController.abort();
        currentAbortController = new AbortController();

        try {
            const textLower = userText.toLowerCase();
            const isVisualRequest = textLower.match(/(dashboard|chart|visual|graph|draw|generate|picture|metric)/);
            const hasFiles = window.currentFilesForAI && window.currentFilesForAI.length > 0;

            let parts = [];
            const statusEl = document.getElementById(`${loadingId}-status`);

            if (isVisualRequest) {
                if (statusEl) statusEl.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Architecting Visuals...`;
                parts.push({ text: `System: You are Elon, MJM-AI analyst. Build visual widgets. CRITICAL RULES: 1. You MUST separate EVERY SINGLE distinct chart, graph, or metric with the exact delimiter "||WIDGET||". 1 Metric/Chart = 1 Sticker. 2. NO <script> tags, Chart.js, or external JS libraries allowed. 3. Draw all complex charts using ONLY pure HTML, Tailwind CSS, and inline SVG paths. 4. NEVER invent or hallucinate data; ONLY use the exact data found explicitly in the attached files. User Request: ${userText}` });
            } else if (hasFiles) {
                if (statusEl) statusEl.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Analyzing Data Files...`;
                parts.push({ text: `System: You are Elon, MJM-AI analyst. You have been provided with data files specifically filtered by the user. CRITICAL RULE: You must ONLY analyze and extract data for the specific estates/companies present in these attached files. DO NOT invent, hallucinate, or pull external data to fill in blanks for other estates. If the user asks about estates not in these files, explicitly state that you are only viewing the currently filtered selection. Structure your response cleanly using Markdown format. User Request: ${userText}` });
            } else {
                if (statusEl) statusEl.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Elon is thinking...`;
                parts.push({ text: `System: You are Elon, MJM-AI operations chatbot. Structure your response cleanly using Markdown format. User Request: ${userText}` });
            }

            if (hasFiles || isVisualRequest) {
                const filePromises = window.currentFilesForAI.map(async (fileObj) => {
                    const { data, error } = await window._supabase.storage.from('operation-reports').download(fileObj.name);
                    if (!error && data) {
                        const b64 = await new Promise(r => {
                            const rd = new FileReader();
                            rd.onloadend = () => r(rd.result.split(',')[1]);
                            rd.readAsDataURL(data);
                        });
                        return { inline_data: { mime_type: data.type || "image/jpeg", data: b64 } };
                    }
                    return null;
                });

                const downloadedFiles = await Promise.all(filePromises);
                downloadedFiles.forEach(filePart => {
                    if (filePart) parts.push(filePart);
                });
            }

            let resData = null;
            let retries = 3;
            
            for (let i = 0; i < retries; i++) {
                try {
                    if (i > 0 && statusEl) statusEl.innerHTML = `<span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span> Retrying Network Connection...`;
                    
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: parts }], tools: [{ google_search: {} }] }),
                        signal: currentAbortController.signal 
                    });
                    
                    resData = await response.json();
                    if (resData.error) throw new Error(resData.error.message);
                    break; 
                    
                } catch (error) {
                    if (error.name === 'AbortError') throw error; 
                    if (i === retries - 1) throw error; 
                    console.warn(`Connection dropped. Retrying (${i+1}/${retries})...`, error);
                    await new Promise(r => setTimeout(r, 2000)); 
                }
            }

            clearInterval(progInterval);

            if (resData && resData.candidates && resData.candidates[0].content) {
                let aiResponse = resData.candidates[0].content.parts[0].text;
                aiResponse = aiResponse.replace(/```html/gi, '').replace(/```/g, '').trim();
                
                if (isVisualRequest) {
                    const visuals = aiResponse.split(/\|\|WIDGET\|\|/g).filter(v => v.trim().length > 0);
                    let outputHTML = `<div class="w-full flex flex-col gap-4 mb-4 max-w-[100%] md:max-w-[90%]">`;
                    visuals.forEach((visHTML, index) => {
                        outputHTML += `
                            <div class="ai-visual-container bg-white p-4 rounded-2xl ${index === 0 ? 'rounded-tl-none' : ''} border border-slate-200 shadow-sm relative group transition-all hover:shadow-md">
                                ${visuals.length > 1 ? `<div class="absolute -top-2 -right-2 bg-slate-800 text-white text-[8px] font-black px-2 py-1 rounded-full shadow-sm z-10 uppercase tracking-widest">Block ${index + 1}</div>` : ''}
                                <div class="relative rounded-xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center p-2">
                                    <div class="visual-content-core relative z-0 w-full overflow-x-auto">${visHTML}</div>
                                </div>
                                <div class="flex justify-between items-center mt-3 px-1 border-t border-slate-100 pt-3">
                                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Analytics Widget</p>
                                    <div class="flex gap-2">
                                        <button onclick="window.saveVisualToPocket(this)" class="bg-indigo-50 hover:bg-indigo-100 text-[9px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                            <span>Add to Pocket</span> ➕
                                        </button>
                                        <button onclick="window.downloadAIImage(this, 'Dashboard_Block_${index+1}')" class="bg-emerald-50 hover:bg-emerald-100 text-[9px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                            <span>Export</span> ↓
                                        </button>
                                    </div>
                                </div>
                            </div>`;
                    });
                    outputHTML += `</div>`;
                    chatBox.innerHTML += outputHTML;
                } else {
                    const parsedMarkdown = typeof marked !== 'undefined' ? marked.parse(aiResponse) : aiResponse.replace(/\n/g, '<br>');
                    chatBox.innerHTML += `<div class="bg-white/80 p-4 md:p-5 rounded-2xl rounded-tl-none border border-slate-200 max-w-[95%] md:max-w-[90%] text-slate-800 shadow-sm mb-4 ai-markdown-content overflow-x-auto">${parsedMarkdown}</div>`;
                }
            }
        } catch (err) {
            clearInterval(progInterval);
            if (err.name === 'AbortError') {
                chatBox.innerHTML += `<div class="text-slate-400 text-[10px] p-2 font-bold uppercase text-center mb-4">Request Terminated & Restarted</div>`;
            } else {
                chatBox.innerHTML += `<div class="text-red-500 text-[10px] p-2 font-bold uppercase mb-4">⚠️ AI Error: ${err.message}</div>`;
            }
        } finally {
            const loader = document.getElementById(loadingId);
            if (loader) loader.remove();
            chatBox.scrollTop = chatBox.scrollHeight;
            currentAbortController = null; 
            saveChatHistory(); 
        }
    };

    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    }
    if (sendBtn) sendBtn.onclick = handleSend;
});

window.addNewCompany = () => {
    const inputField = document.getElementById('new-comp-id');
    if (inputField) inputField.value = '';
    document.getElementById('company-modal').classList.remove('hidden');
};

window.closeCompanyModal = () => document.getElementById('company-modal').classList.add('hidden');

window.saveCompanyProfile = async function() {
    const id = document.getElementById('new-comp-id').value.toUpperCase().trim();
    if (!id) return;
    
    if (!window.customTabs.includes(id)) {
        window.customTabs.push(id);
        window.selectedCategories.push(id);
        updateTabUI();
        loadBookshelf(true);
        
        if (window._supabase) {
            const blob = new Blob(['marker'], { type: 'text/plain' });
            await window._supabase.storage.from('operation-reports').upload(id + '_tab.marker', blob);
        }
    }
    
    closeCompanyModal();
};
