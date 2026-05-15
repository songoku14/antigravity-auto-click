(function() {
    const vscode = acquireVsCodeApi();
    
    // DOM Elements
    const pageMain = document.getElementById('page-main');
    const pageStats = document.getElementById('page-stats');
    
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    const blacklistTags = document.getElementById('blacklist-tags');
    const blacklistAddInput = document.getElementById('blacklist-add-input');
    const btnAddBlacklist = document.getElementById('btn-add-blacklist');
    const notificationToast = document.getElementById('notification-toast');
    
    let currentBlacklist = [];
    let notificationTimeout;

    const statRetryTotal = document.getElementById('stat-retry-total');
    // ... (rest of stats)

    // Actions
    document.getElementById('btn-open-config').addEventListener('click', () => {
        vscode.postMessage({ type: 'OPEN_CONFIG' });
    });

    document.getElementById('btn-reset-stats').addEventListener('click', () => {
        vscode.postMessage({ type: 'RESET_STATS' });
    });

    // Blacklist Logic
    function renderBlacklist(list) {
        currentBlacklist = list || [];
        blacklistTags.innerHTML = '';
        
        currentBlacklist.forEach((item, index) => {
            const tag = document.createElement('div');
            tag.className = 'blacklist-tag';
            tag.innerHTML = `
                <span>${item}</span>
                <span class="remove-btn" data-index="${index}">&times;</span>
            `;
            blacklistTags.appendChild(tag);
        });

        // Add remove listeners
        blacklistTags.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const removedItem = currentBlacklist[idx];
                const newList = [...currentBlacklist];
                newList.splice(idx, 1);
                updateBlacklistOnServer(newList);
                showNotification(`Đã xóa "${removedItem}"`);
            });
        });
    }

    function updateBlacklistOnServer(newList) {
        vscode.postMessage({
            type: 'UPDATE_BLACKLIST',
            value: newList.join(',')
        });
    }

    function addItemToBlacklist() {
        const val = blacklistAddInput.value.trim();
        if (!val) return;
        
        if (currentBlacklist.includes(val)) {
            showNotification(`"${val}" đã có trong danh sách`, true);
            return;
        }

        const newList = [...currentBlacklist, val];
        updateBlacklistOnServer(newList);
        blacklistAddInput.value = '';
        showNotification(`Đã thêm "${val}"`);
    }

    btnAddBlacklist.addEventListener('click', addItemToBlacklist);
    blacklistAddInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItemToBlacklist();
    });

    function showNotification(message, isError = false) {
        if (notificationTimeout) clearTimeout(notificationTimeout);
        
        notificationToast.textContent = message;
        notificationToast.style.background = isError ? 'var(--error)' : 'var(--accent)';
        notificationToast.classList.remove('hidden');
        
        notificationTimeout = setTimeout(() => {
            notificationToast.classList.add('hidden');
        }, 2000);
    }

    // Feature Toggles (rest of the code remains similar but needs updating references)
    const toggles = {
        'autoRetry.enabled': document.getElementById('toggle-retry'),
        'autoAccept.enabled': document.getElementById('toggle-accept'),
        'autoAccept.categories.terminal.enabled': document.getElementById('toggle-terminal'),
        'autoAccept.categories.reviewChange.enabled': document.getElementById('toggle-review'),
        'autoAccept.categories.systemReview.enabled': document.getElementById('toggle-system')
    };

    Object.keys(toggles).forEach(feature => {
        toggles[feature].addEventListener('change', async (e) => {
            const value = e.target.checked;
            
            // Special logic for Auto Accept synchronization
            if (feature === 'autoAccept.enabled') {
                // Master Toggle: sync all categories
                const categories = [
                    'autoAccept.categories.terminal.enabled',
                    'autoAccept.categories.reviewChange.enabled',
                    'autoAccept.categories.systemReview.enabled'
                ];
                
                categories.forEach(catKey => {
                    const el = toggles[catKey];
                    if (el) el.checked = value;
                    vscode.postMessage({
                        type: 'TOGGLE_FEATURE',
                        feature: catKey,
                        value: value
                    });
                });
            } else if (feature.startsWith('autoAccept.categories.')) {
                // Category Toggle: sync master
                const masterToggle = toggles['autoAccept.enabled'];
                const subKeys = [
                    'autoAccept.categories.terminal.enabled',
                    'autoAccept.categories.reviewChange.enabled',
                    'autoAccept.categories.systemReview.enabled'
                ];
                
                // Get fresh state from DOM
                const anyEnabled = subKeys.some(key => toggles[key] && toggles[key].checked);
                
                if (anyEnabled && !masterToggle.checked) {
                    masterToggle.checked = true;
                    vscode.postMessage({
                        type: 'TOGGLE_FEATURE',
                        feature: 'autoAccept.enabled',
                        value: true
                    });
                } else if (!anyEnabled && masterToggle.checked) {
                    // Optional: turn off master if all categories off
                    masterToggle.checked = false;
                    vscode.postMessage({
                        type: 'TOGGLE_FEATURE',
                        feature: 'autoAccept.enabled',
                        value: false
                    });
                }
            }

            // Always send the message for the clicked toggle itself
            vscode.postMessage({
                type: 'TOGGLE_FEATURE',
                feature: feature,
                value: value
            });
        });
    });

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'UPDATE_STATE':
                updateUI(message.state);
                break;
        }
    });

    function updateUI(state) {
        const { config, daemonState, activitySummary } = state;

        // Update Status
        if (daemonState.running) {
            statusDot.classList.add('running');
            statusText.textContent = 'Đang chạy';
        } else {
            statusDot.classList.remove('running');
            statusText.textContent = 'Đã dừng';
        }

        // Update Toggles
        Object.keys(toggles).forEach(key => {
            const path = key.split('.');
            let val = config;
            for (const part of path) val = val[part];
            updateToggle(toggles[key], val);
        });

        // Update Category Buttons
        renderCategoryButtons(config.autoAccept.categories);

        // Update Visual State of Categories
        const categoriesContainer = document.getElementById('categories-container');
        if (categoriesContainer) {
            if (config.autoAccept.enabled) {
                categoriesContainer.classList.remove('dimmed');
                categoriesContainer.style.opacity = '1';
            } else {
                categoriesContainer.classList.add('dimmed');
                categoriesContainer.style.opacity = '0.7';
            }
            // Ensure interaction is always possible
            categoriesContainer.style.pointerEvents = 'auto';
        }

        // Update Blacklist
        renderBlacklist(config.autoAccept.blacklist);

        // Update Stats
        renderStats(activitySummary);
    }

    function renderCategoryButtons(categories) {
        const categoryKeys = ['terminal', 'reviewChange', 'systemReview'];
        
        categoryKeys.forEach(key => {
            const container = document.getElementById(`buttons-${key}`);
            if (!container) return;
            
            container.innerHTML = '';
            const category = categories[key];
            
            if (category && category.buttons && category.buttons.length > 0) {
                category.buttons.forEach(btnPattern => {
                    const tag = document.createElement('span');
                    tag.className = 'cmd-tag';
                    // Convert regex string to readable text
                    let text = btnPattern;
                    if (text.startsWith('/') && (text.endsWith('/i') || text.endsWith('/'))) {
                        text = text.substring(1, text.lastIndexOf('/'));
                    }
                    
                    // Clean up regex artifacts
                    text = text.replace(/^\^/, '').replace(/\$$/, ''); // Anchors
                    text = text.replace(/\\s\*/g, ' '); // \s* -> space
                    text = text.replace(/\\s\+/g, ' '); // \s+ -> space
                    text = text.replace(/\\/g, '');    // Remove remaining escapes
                    
                    tag.textContent = text.trim();
                    container.appendChild(tag);
                });
            } else if (key === 'systemReview') {
                const tag = document.createElement('span');
                tag.className = 'cmd-tag';
                tag.style.borderColor = 'var(--error)';
                tag.style.color = 'var(--error)';
                tag.textContent = 'high risk';
                container.appendChild(tag);
            }
        });
    }

    function updateToggle(el, value) {
        if (el) el.checked = !!value;
    }

    function renderStats(summary) {
        const statTotalActions = document.getElementById('stat-total-actions');
        const statRetryTotal = document.getElementById('stat-retry-total');
        const statAcceptTotal = document.getElementById('stat-accept-total');
        
        const retryCount = summary.retryClicks || 0;
        const acceptCount = summary.acceptClicks || 0;
        const totalActions = retryCount + acceptCount;

        if (statTotalActions) statTotalActions.textContent = totalActions.toLocaleString();
        if (statRetryTotal) statRetryTotal.textContent = retryCount.toLocaleString();
        if (statAcceptTotal) statAcceptTotal.textContent = acceptCount.toLocaleString();
        
        if (summary.byCategory) {
            const categories = ['terminal', 'reviewChange', 'systemReview'];
            const idMap = {
                'terminal': 'stat-accept-t',
                'reviewChange': 'stat-accept-r',
                'systemReview': 'stat-accept-s'
            };
            const barMap = {
                'terminal': 'bar-terminal',
                'reviewChange': 'bar-review',
                'systemReview': 'bar-system'
            };

            categories.forEach(cat => {
                const count = summary.byCategory[cat] || 0;
                const el = document.getElementById(idMap[cat]);
                const bar = document.getElementById(barMap[cat]);
                
                if (el) el.textContent = count;
                if (bar) {
                    const pct = acceptCount > 0 ? (count / acceptCount) * 100 : 0;
                    bar.style.width = `${pct}%`;
                }
            });
        }
    }

    // Signal that we are ready
    vscode.postMessage({ type: 'READY' });
})();
