// API Tester JavaScript
(function() {
  'use strict';

  // DOM Elements
  const methodSelect = document.getElementById('methodSelect');
  const urlInput = document.getElementById('urlInput');
  const sendBtn = document.getElementById('sendBtn');
  const importCurlBtn = document.getElementById('importCurlBtn');
  const clearBtn = document.getElementById('clearBtn');
  const historyBtn = document.getElementById('historyBtn');
  const loadRecordsBtn = document.getElementById('loadRecordsBtn');
  const importModal = document.getElementById('importModal');
  const historyModal = document.getElementById('historyModal');
  const recordsModal = document.getElementById('recordsModal');
  const curlInput = document.getElementById('curlInput');
  const cancelImport = document.getElementById('cancelImport');
  const confirmImport = document.getElementById('confirmImport');
  const closeHistory = document.getElementById('closeHistory');
  const clearHistory = document.getElementById('clearHistory');
  const historyList = document.getElementById('historyList');
  const recordsList = document.getElementById('recordsList');
  const closeRecords = document.getElementById('closeRecords');
  const refreshRecords = document.getElementById('refreshRecords');
  const bodyEditor = document.getElementById('bodyEditor');
  const authType = document.getElementById('authType');
  const authFields = document.getElementById('authFields');
  const loading = document.getElementById('loading');
  const responseStatus = document.getElementById('responseStatus');
  const statusCode = document.getElementById('statusCode');
  const responseTime = document.getElementById('responseTime');
  const responseSize = document.getElementById('responseSize');
  const responseBody = document.getElementById('responseBody');
  const responseHeaders = document.getElementById('responseHeaders');
  const emptyState = document.getElementById('emptyState');

  // History storage
  let requestHistory = [];

  // Initialize
  function init() {
    loadHistory();
    setupTabs();
    setupKeyValueEditors();
    setupAuthFields();
    setupEventListeners();
    setupRecordsModal();
    setupViewModeToggle();
    updateMethodColor();
    
    // Check if there's a pending cURL to import
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['pendingCurl'], (result) => {
        if (result.pendingCurl) {
          parseCurl(result.pendingCurl);
          // Clear the pending curl
          chrome.storage.local.remove('pendingCurl');
        }
      });
    }
  }

  // Setup tab switching
  function setupTabs() {
    document.querySelectorAll('.tabs').forEach(tabContainer => {
      tabContainer.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          const panel = tab.closest('.panel');
          
          // Update active tab
          panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          
          // Update active content
          panel.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
          });
          document.getElementById(`${tabName}-tab`).classList.add('active');
        });
      });
    });
  }

  // Setup key-value editors (params, headers)
  function setupKeyValueEditors() {
    document.querySelectorAll('.add-row-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const editorId = btn.dataset.editor;
        addKeyValueRow(editorId);
      });
    });

    // Setup delete buttons for existing rows
    document.querySelectorAll('.kv-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('.kv-row');
        const editor = row.parentElement;
        if (editor.querySelectorAll('.kv-row').length > 1) {
          row.remove();
        } else {
          row.querySelector('.kv-key').value = '';
          row.querySelector('.kv-value').value = '';
        }
      });
    });
  }

  // Add new key-value row
  function addKeyValueRow(editorId, key = '', value = '', checked = true) {
    const editor = document.getElementById(editorId);
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="checkbox" class="kv-checkbox" ${checked ? 'checked' : ''}>
      <input type="text" class="kv-key" placeholder="Key" value="${escapeHtml(key)}">
      <input type="text" class="kv-value" placeholder="Value" value="${escapeHtml(value)}">
      <button class="kv-delete">✕</button>
    `;
    
    row.querySelector('.kv-delete').addEventListener('click', () => {
      if (editor.querySelectorAll('.kv-row').length > 1) {
        row.remove();
      } else {
        row.querySelector('.kv-key').value = '';
        row.querySelector('.kv-value').value = '';
      }
    });
    
    editor.appendChild(row);
    return row;
  }

  // Setup auth fields
  function setupAuthFields() {
    authType.addEventListener('change', () => {
      const type = authType.value;
      authFields.innerHTML = '';
      
      switch(type) {
        case 'bearer':
          authFields.innerHTML = `
            <input type="text" class="url-input" id="bearerToken" placeholder="Enter Bearer Token" style="width: 100%;">
          `;
          break;
        case 'basic':
          authFields.innerHTML = `
            <input type="text" class="url-input" id="basicUsername" placeholder="Username" style="width: 100%; margin-bottom: 10px;">
            <input type="password" class="url-input" id="basicPassword" placeholder="Password" style="width: 100%;">
          `;
          break;
        case 'apikey':
          authFields.innerHTML = `
            <input type="text" class="url-input" id="apiKeyName" placeholder="Key Name (e.g., X-API-Key)" style="width: 100%; margin-bottom: 10px;">
            <input type="text" class="url-input" id="apiKeyValue" placeholder="Key Value" style="width: 100%; margin-bottom: 10px;">
            <select class="method-select" id="apiKeyIn" style="width: 100%;">
              <option value="header">Add to Header</option>
              <option value="query">Add to Query Params</option>
            </select>
          `;
          break;
      }
    });
  }

  // Setup event listeners
  function setupEventListeners() {
    // Method color update
    methodSelect.addEventListener('change', updateMethodColor);
    
    // Send request
    sendBtn.addEventListener('click', sendRequest);
    
    // Import cURL
    importCurlBtn.addEventListener('click', () => {
      importModal.classList.add('show');
      curlInput.focus();
    });
    
    cancelImport.addEventListener('click', () => {
      importModal.classList.remove('show');
      curlInput.value = '';
    });
    
    confirmImport.addEventListener('click', () => {
      parseCurl(curlInput.value);
      importModal.classList.remove('show');
      curlInput.value = '';
    });
    
    // History
    historyBtn.addEventListener('click', () => {
      renderHistory();
      historyModal.classList.add('show');
    });
    
    closeHistory.addEventListener('click', () => {
      historyModal.classList.remove('show');
    });
    
    clearHistory.addEventListener('click', () => {
      requestHistory = [];
      saveHistory();
      renderHistory();
    });
    
    // Clear
    clearBtn.addEventListener('click', clearAll);
    
    // Close modals on outside click
    [importModal, historyModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });
    
    // Keyboard shortcut: Ctrl+Enter to send
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        sendRequest();
      }
    });
  }

  // Update method select color
  function updateMethodColor() {
    const method = methodSelect.value;
    methodSelect.className = 'method-select';
    methodSelect.classList.add(`method-${method.toLowerCase()}`);
  }

  // Parse cURL command
  function parseCurl(curlString) {
    try {
      // Clean up the curl string
      let curl = curlString.trim();
      
      // Remove line continuations
      curl = curl.replace(/\\\s*\n/g, ' ');
      curl = curl.replace(/\\\s*$/gm, ' ');
      
      // Extract URL
      let url = '';
      const urlMatch = curl.match(/curl\s+['"]?([^'">\s]+)['"]?/i) || 
                       curl.match(/--url\s+['"]?([^'">\s]+)['"]?/i);
      if (urlMatch) {
        url = urlMatch[1];
      }
      
      // Extract method
      let method = 'GET';
      const methodMatch = curl.match(/-X\s+['"]?(\w+)['"]?/i) || 
                          curl.match(/--request\s+['"]?(\w+)['"]?/i);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
      } else if (curl.includes('-d ') || curl.includes('--data')) {
        method = 'POST';
      }
      
      // Extract headers
      const headers = [];
      const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
      let headerMatch;
      while ((headerMatch = headerRegex.exec(curl)) !== null) {
        const [name, ...valueParts] = headerMatch[1].split(':');
        const value = valueParts.join(':').trim();
        if (name && value) {
          headers.push({ name: name.trim(), value });
        }
      }
      
      // Extract data/body
      let body = '';
      const dataMatch = curl.match(/-d\s+['"](.+?)['"](?=\s+-|$)/s) ||
                        curl.match(/--data\s+['"](.+?)['"](?=\s+-|$)/s) ||
                        curl.match(/--data-raw\s+['"](.+?)['"](?=\s+-|$)/s);
      if (dataMatch) {
        body = dataMatch[1];
        // Try to parse and format JSON
        try {
          const parsed = JSON.parse(body);
          body = JSON.stringify(parsed, null, 2);
        } catch(e) {
          // Keep as-is if not valid JSON
        }
      }
      
      // Apply parsed values
      urlInput.value = url;
      methodSelect.value = method;
      updateMethodColor();
      
      // Clear and set headers
      const headersEditor = document.getElementById('headersEditor');
      headersEditor.innerHTML = '';
      if (headers.length > 0) {
        headers.forEach(h => addKeyValueRow('headersEditor', h.name, h.value));
      } else {
        addKeyValueRow('headersEditor', 'Content-Type', 'application/json');
      }
      
      // Set body
      if (body) {
        bodyEditor.value = body;
        // Select JSON body type
        document.querySelector('input[name="bodyType"][value="json"]').checked = true;
        // Switch to body tab
        document.querySelector('.tab[data-tab="body"]').click();
      }
      
      showNotification('cURL imported successfully!', 'success');
    } catch(e) {
      console.error('Error parsing cURL:', e);
      showNotification('Failed to parse cURL command', 'error');
    }
  }

  // Get key-value pairs from editor
  function getKeyValuePairs(editorId) {
    const pairs = [];
    const editor = document.getElementById(editorId);
    editor.querySelectorAll('.kv-row').forEach(row => {
      const checked = row.querySelector('.kv-checkbox').checked;
      const key = row.querySelector('.kv-key').value.trim();
      const value = row.querySelector('.kv-value').value.trim();
      if (checked && key) {
        pairs.push({ key, value });
      }
    });
    return pairs;
  }

  // Build URL with query params
  function buildUrl(baseUrl, params) {
    if (!params.length) return baseUrl;
    
    const url = new URL(baseUrl);
    params.forEach(p => {
      url.searchParams.append(p.key, p.value);
    });
    return url.toString();
  }

  // Get auth headers
  function getAuthHeaders() {
    const headers = {};
    const type = authType.value;
    
    switch(type) {
      case 'bearer':
        const token = document.getElementById('bearerToken')?.value;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
      case 'basic':
        const username = document.getElementById('basicUsername')?.value || '';
        const password = document.getElementById('basicPassword')?.value || '';
        if (username) {
          headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
        }
        break;
      case 'apikey':
        const keyName = document.getElementById('apiKeyName')?.value;
        const keyValue = document.getElementById('apiKeyValue')?.value;
        const keyIn = document.getElementById('apiKeyIn')?.value || 'header';
        if (keyName && keyValue && keyIn === 'header') {
          headers[keyName] = keyValue;
        }
        break;
    }
    
    return headers;
  }

  // Get API key params (for query string)
  function getApiKeyParams() {
    if (authType.value === 'apikey') {
      const keyName = document.getElementById('apiKeyName')?.value;
      const keyValue = document.getElementById('apiKeyValue')?.value;
      const keyIn = document.getElementById('apiKeyIn')?.value || 'header';
      if (keyName && keyValue && keyIn === 'query') {
        return [{ key: keyName, value: keyValue }];
      }
    }
    return [];
  }

  // Send HTTP request
  async function sendRequest() {
    const method = methodSelect.value;
    let url = urlInput.value.trim();
    
    if (!url) {
      showNotification('Please enter a URL', 'error');
      urlInput.focus();
      return;
    }
    
    // Add protocol if missing
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
      urlInput.value = url;
    }
    
    // Get params and add API key if needed
    const params = [...getKeyValuePairs('paramsEditor'), ...getApiKeyParams()];
    const finalUrl = buildUrl(url, params);
    
    // Get headers
    const headerPairs = getKeyValuePairs('headersEditor');
    const headers = {};
    headerPairs.forEach(h => {
      headers[h.key] = h.value;
    });
    
    // Add auth headers
    Object.assign(headers, getAuthHeaders());
    
    // Get body
    let body = null;
    const bodyType = document.querySelector('input[name="bodyType"]:checked').value;
    
    if (method !== 'GET' && method !== 'HEAD' && bodyType !== 'none') {
      body = bodyEditor.value;
      
      if (bodyType === 'json' && body) {
        try {
          // Validate JSON
          JSON.parse(body);
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
          }
        } catch(e) {
          showNotification('Invalid JSON in request body', 'error');
          return;
        }
      } else if (bodyType === 'urlencoded') {
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
    }
    
    // Show loading
    loading.classList.add('show');
    emptyState.style.display = 'none';
    responseBody.style.display = 'none';
    responseStatus.style.display = 'none';
    sendBtn.disabled = true;
    
    const startTime = performance.now();
    
    try {
      const response = await fetch(finalUrl, {
        method,
        headers,
        body,
        mode: 'cors',
        credentials: 'omit'
      });
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      // Get response body
      const contentType = response.headers.get('content-type') || '';
      let responseText = await response.text();
      let formattedResponse = responseText;
      
      // Try to format as JSON
      if (contentType.includes('application/json') || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        try {
          const json = JSON.parse(responseText);
          formattedResponse = syntaxHighlightJson(JSON.stringify(json, null, 2));
        } catch(e) {
          formattedResponse = escapeHtml(responseText);
        }
      } else {
        formattedResponse = escapeHtml(responseText);
      }
      
      // Display response
      const size = new Blob([responseText]).size;
      displayResponse(response.status, response.statusText, duration, size, formattedResponse, response.headers);
      
      // Save to history
      addToHistory({
        method,
        url: finalUrl,
        status: response.status,
        time: duration,
        timestamp: Date.now()
      });
      
    } catch(error) {
      console.error('Request failed:', error);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      displayError(error, duration);
    } finally {
      loading.classList.remove('show');
      sendBtn.disabled = false;
    }
  }

  // Lưu raw response để switch view mode
  let lastRawResponse = '';
  let lastFormattedResponse = '';
  let currentViewMode = 'pretty';

  // HTTP Status Text mapping
  const HTTP_STATUS_TEXT = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict',
    500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
    503: 'Service Unavailable', 504: 'Gateway Timeout'
  };

  // Display response
  function displayResponse(status, statusText, time, size, body, headers) {
    // Fix duplicate status text (e.g., "200 200" -> "200 OK")
    let finalStatusText = statusText;
    if (!statusText || statusText === String(status) || statusText === '') {
      finalStatusText = HTTP_STATUS_TEXT[status] || 'Unknown';
    }
    
    // Status
    responseStatus.style.display = 'flex';
    statusCode.textContent = `${status} ${finalStatusText}`;
    statusCode.className = 'status-code';
    if (status >= 200 && status < 300) statusCode.classList.add('status-2xx');
    else if (status >= 300 && status < 400) statusCode.classList.add('status-3xx');
    else if (status >= 400 && status < 500) statusCode.classList.add('status-4xx');
    else if (status >= 500) statusCode.classList.add('status-5xx');
    
    responseTime.textContent = `Time: ${time}ms`;
    responseSize.textContent = `Size: ${formatSize(size)}`;
    
    // Lưu response
    lastFormattedResponse = body;
    // Lấy raw text từ body (strip HTML)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = body;
    lastRawResponse = tempDiv.textContent || tempDiv.innerText || body;
    
    // Body
    const responseBodyWrapper = document.getElementById('responseBodyWrapper');
    if (responseBodyWrapper) {
      responseBodyWrapper.style.display = 'flex';
    }
    responseBody.innerHTML = body;
    responseBody.style.display = 'block';
    responseBody.classList.add('active');
    emptyState.style.display = 'none';
    
    // Update preview iframe
    updatePreviewFrame();
    
    // Reset view mode to pretty
    setViewMode('pretty');
    
    // Headers
    responseHeaders.innerHTML = '';
    headers.forEach((value, name) => {
      const div = document.createElement('div');
      div.innerHTML = `<span class="header-name">${escapeHtml(name)}</span>: <span class="header-value">${escapeHtml(value)}</span>`;
      responseHeaders.appendChild(div);
    });
  }
  
  // Update preview iframe with HTML content
  function updatePreviewFrame() {
    const previewFrame = document.getElementById('previewFrame');
    if (previewFrame && lastRawResponse) {
      try {
        // Use srcdoc to bypass extension CSP
        previewFrame.srcdoc = lastRawResponse;
      } catch(e) {
        console.error('Error updating preview:', e);
      }
    }
  }
  
  // Set view mode (pretty, raw, preview)
  function setViewMode(mode) {
    currentViewMode = mode;
    
    const viewPretty = document.getElementById('viewPretty');
    const viewRaw = document.getElementById('viewRaw');
    const viewPreview = document.getElementById('viewPreview');
    const responseBodyRaw = document.getElementById('responseBodyRaw');
    const responsePreview = document.getElementById('responsePreview');
    
    // Remove active from all buttons
    [viewPretty, viewRaw, viewPreview].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    
    // Hide all views
    if (responseBody) responseBody.style.display = 'none';
    if (responseBodyRaw) responseBodyRaw.style.display = 'none';
    if (responsePreview) responsePreview.classList.remove('active');
    
    // Show selected view
    switch(mode) {
      case 'pretty':
        if (viewPretty) viewPretty.classList.add('active');
        if (responseBody) {
          responseBody.style.display = 'block';
          responseBody.innerHTML = lastFormattedResponse;
        }
        break;
      case 'raw':
        if (viewRaw) viewRaw.classList.add('active');
        if (responseBodyRaw) {
          responseBodyRaw.style.display = 'block';
          responseBodyRaw.textContent = lastRawResponse;
        }
        break;
      case 'preview':
        if (viewPreview) viewPreview.classList.add('active');
        if (responsePreview) {
          responsePreview.classList.add('active');
          updatePreviewFrame();
        }
        break;
    }
  }
  
  // Setup view mode toggle buttons
  function setupViewModeToggle() {
    const viewPretty = document.getElementById('viewPretty');
    const viewRaw = document.getElementById('viewRaw');
    const viewPreview = document.getElementById('viewPreview');
    
    if (viewPretty) viewPretty.addEventListener('click', () => setViewMode('pretty'));
    if (viewRaw) viewRaw.addEventListener('click', () => setViewMode('raw'));
    if (viewPreview) viewPreview.addEventListener('click', () => setViewMode('preview'));
  }

  // Display error
  function displayError(error, time) {
    responseStatus.style.display = 'flex';
    statusCode.textContent = 'Error';
    statusCode.className = 'status-code status-5xx';
    responseTime.textContent = `Time: ${time}ms`;
    responseSize.textContent = '';
    
    responseBody.innerHTML = `<span style="color: #f14c4c;">❌ Request Failed</span>\n\n${escapeHtml(error.message)}\n\n<span style="color: #888;">This might be due to CORS restrictions. Try using a proxy or testing from a backend.</span>`;
    responseBody.style.display = 'block';
    emptyState.style.display = 'none';
  }

  // Format file size
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // Syntax highlight JSON
  function syntaxHighlightJson(json) {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
          match = match.replace(/:$/, '') + ':';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Show notification
  function showNotification(message, type = 'info') {
    // Simple notification - could be enhanced with a toast library
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#c42b1c' : '#388a34'};
      color: white;
      border-radius: 6px;
      z-index: 10000;
      animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
  }

  // Clear all fields
  function clearAll() {
    urlInput.value = '';
    methodSelect.value = 'GET';
    updateMethodColor();
    bodyEditor.value = '';
    
    // Reset params
    const paramsEditor = document.getElementById('paramsEditor');
    paramsEditor.innerHTML = '';
    addKeyValueRow('paramsEditor');
    
    // Reset headers
    const headersEditor = document.getElementById('headersEditor');
    headersEditor.innerHTML = '';
    addKeyValueRow('headersEditor', 'Content-Type', 'application/json');
    
    // Reset auth
    authType.value = 'none';
    authFields.innerHTML = '';
    
    // Reset body type
    document.querySelector('input[name="bodyType"][value="none"]').checked = true;
    
    // Reset response
    responseStatus.style.display = 'none';
    responseBody.style.display = 'none';
    emptyState.style.display = 'flex';
    responseHeaders.innerHTML = '';
    
    urlInput.focus();
  }

  // History functions
  function loadHistory() {
    try {
      const saved = localStorage.getItem('apiTesterHistory');
      if (saved) {
        requestHistory = JSON.parse(saved);
      }
    } catch(e) {
      console.error('Failed to load history:', e);
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('apiTesterHistory', JSON.stringify(requestHistory.slice(0, 50)));
    } catch(e) {
      console.error('Failed to save history:', e);
    }
  }

  function addToHistory(item) {
    requestHistory.unshift(item);
    if (requestHistory.length > 50) {
      requestHistory = requestHistory.slice(0, 50);
    }
    saveHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    
    if (requestHistory.length === 0) {
      historyList.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No history yet</div>';
      return;
    }
    
    requestHistory.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      
      const methodColor = {
        'GET': '#4ec9b0',
        'POST': '#dcdcaa',
        'PUT': '#569cd6',
        'DELETE': '#f14c4c',
        'PATCH': '#ce9178'
      }[item.method] || '#888';
      
      const statusColor = item.status >= 200 && item.status < 300 ? '#4ec9b0' : 
                          item.status >= 400 ? '#f14c4c' : '#dcdcaa';
      
      div.innerHTML = `
        <span class="method" style="background: ${methodColor}20; color: ${methodColor};">${item.method}</span>
        <span style="color: ${statusColor}; font-size: 11px; margin-right: 8px;">${item.status}</span>
        <span style="color: #888; font-size: 11px;">${item.time}ms</span>
        <div class="url">${escapeHtml(item.url)}</div>
        <div class="time">${new Date(item.timestamp).toLocaleString()}</div>
      `;
      
      div.addEventListener('click', () => {
        urlInput.value = item.url;
        methodSelect.value = item.method;
        updateMethodColor();
        historyModal.classList.remove('show');
      });
      
      historyList.appendChild(div);
    });
  }

  // ==================== LOAD RECORDS ====================
  
  function setupRecordsModal() {
    if (loadRecordsBtn) {
      loadRecordsBtn.addEventListener('click', () => {
        loadRecordedRequests();
        recordsModal.classList.add('show');
      });
    }
    
    if (closeRecords) {
      closeRecords.addEventListener('click', () => {
        recordsModal.classList.remove('show');
      });
    }
    
    if (refreshRecords) {
      refreshRecords.addEventListener('click', loadRecordedRequests);
    }
    
    // Search input
    const recordsSearchInput = document.getElementById('recordsSearchInput');
    if (recordsSearchInput) {
      recordsSearchInput.addEventListener('input', (e) => {
        filterRecordsList(e.target.value);
      });
    }
    
    // Close modal when clicking outside
    if (recordsModal) {
      recordsModal.addEventListener('click', (e) => {
        if (e.target === recordsModal) {
          recordsModal.classList.remove('show');
        }
      });
    }
  }
  
  // Lưu tất cả records để filter
  let allRecordedRequests = [];
  
  function filterRecordsList(searchTerm) {
    const items = document.querySelectorAll('#recordsList .record-item');
    const term = searchTerm.toLowerCase().trim();
    let visibleCount = 0;
    
    items.forEach(item => {
      const url = item.querySelector('.url')?.textContent?.toLowerCase() || '';
      const method = item.querySelector('.method')?.textContent?.toLowerCase() || '';
      
      if (!term || url.includes(term) || method.includes(term)) {
        item.style.display = '';
        visibleCount++;
      } else {
        item.style.display = 'none';
      }
    });
    
    // Update count
    const recordsCount = document.getElementById('recordsCount');
    if (recordsCount) {
      recordsCount.textContent = `Hiển thị ${visibleCount}/${items.length} requests`;
    }
  }
  
  function loadRecordedRequests() {
    if (!recordsList) return;
    
    // Clear search input
    const recordsSearchInput = document.getElementById('recordsSearchInput');
    if (recordsSearchInput) {
      recordsSearchInput.value = '';
    }
    
    // Gửi message đến background để lấy recorded requests
    chrome.runtime.sendMessage({ action: 'getRecordedRequests' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting recorded requests:', chrome.runtime.lastError);
        recordsList.innerHTML = `
          <div class="records-empty">
            <div class="icon">⚠️</div>
            <div>Không thể kết nối với background script</div>
          </div>
        `;
        return;
      }
      
      const requests = response?.requests || [];
      allRecordedRequests = requests;
      
      // Update count
      const recordsCount = document.getElementById('recordsCount');
      if (recordsCount) {
        recordsCount.textContent = `Tổng: ${requests.length} requests`;
      }
      
      if (requests.length === 0) {
        recordsList.innerHTML = `
          <div class="records-empty">
            <div class="icon">📭</div>
            <div>Chưa có request nào được record</div>
            <div style="margin-top: 10px; font-size: 11px;">
              Bật "Record Requests" trong popup để bắt đầu ghi lại requests
            </div>
          </div>
        `;
        return;
      }
      
      recordsList.innerHTML = '';
      
      // Show most recent first
      requests.slice().reverse().forEach((req, index) => {
        const div = document.createElement('div');
        div.className = 'record-item';
        
        const method = req.method || 'GET';
        const url = req.url || '';
        const timestamp = req.timestamp ? new Date(req.timestamp).toLocaleString() : '';
        const hasBody = req.body && req.body.length > 0;
        const headersCount = req.headers ? Object.keys(req.headers).length : 0;
        
        div.innerHTML = `
          <div class="record-header">
            <span class="method method-${method}">${method}</span>
            <span class="url">${escapeHtml(url)}</span>
          </div>
          <div class="meta">
            <span>📅 ${timestamp}</span>
            <span>📋 ${headersCount} headers</span>
            ${hasBody ? '<span>📦 Has body</span>' : ''}
          </div>
        `;
        
        div.addEventListener('click', () => {
          loadRequestIntoForm(req);
          recordsModal.classList.remove('show');
          showNotification('Request loaded!', 'success');
        });
        
        recordsList.appendChild(div);
      });
    });
  }
  
  function loadRequestIntoForm(req) {
    // Set URL
    urlInput.value = req.url || '';
    
    // Set method
    const method = (req.method || 'GET').toUpperCase();
    if (methodSelect.querySelector(`option[value="${method}"]`)) {
      methodSelect.value = method;
    } else {
      methodSelect.value = 'GET';
    }
    updateMethodColor();
    
    // Set headers
    const headersEditor = document.getElementById('headersEditor');
    headersEditor.innerHTML = '';
    
    if (req.headers && Object.keys(req.headers).length > 0) {
      Object.entries(req.headers).forEach(([name, value]) => {
        // Skip some internal headers
        if (name.toLowerCase().startsWith('sec-') || 
            name.toLowerCase() === 'host' ||
            name.toLowerCase() === 'connection') {
          return;
        }
        addKeyValueRow('headersEditor', name, value);
      });
    }
    
    // Ensure at least one header row
    if (headersEditor.querySelectorAll('.kv-row').length === 0) {
      addKeyValueRow('headersEditor', 'Content-Type', 'application/json');
    }
    
    // Set body
    if (req.body) {
      let bodyContent = req.body;
      
      // Try to format JSON
      try {
        const parsed = JSON.parse(req.body);
        bodyContent = JSON.stringify(parsed, null, 2);
        document.querySelector('input[name="bodyType"][value="json"]').checked = true;
      } catch(e) {
        document.querySelector('input[name="bodyType"][value="raw"]').checked = true;
      }
      
      bodyEditor.value = bodyContent;
      
      // Switch to body tab if there's body content
      document.querySelector('.tab[data-tab="body"]').click();
    } else {
      bodyEditor.value = '';
      document.querySelector('input[name="bodyType"][value="none"]').checked = true;
    }
    
    // Handle authorization header
    if (req.headers) {
      const authHeader = Object.entries(req.headers).find(
        ([name]) => name.toLowerCase() === 'authorization'
      );
      
      if (authHeader) {
        const [, value] = authHeader;
        if (value.toLowerCase().startsWith('bearer ')) {
          authType.value = 'bearer';
          authType.dispatchEvent(new Event('change'));
          setTimeout(() => {
            const tokenInput = document.getElementById('bearerToken');
            if (tokenInput) {
              tokenInput.value = value.substring(7);
            }
          }, 50);
        } else if (value.toLowerCase().startsWith('basic ')) {
          authType.value = 'basic';
          authType.dispatchEvent(new Event('change'));
        }
      }
    }
  }

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  `;
  document.head.appendChild(style);

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
