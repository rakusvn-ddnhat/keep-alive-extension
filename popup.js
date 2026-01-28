// I18n system
let currentLang = 'vi';
let messages = {};

// Global reference to UI elements (will be set in DOMContentLoaded)
let requestCountElement = null;
let exportCurlBtn = null;
let exportJMeterBtn = null;
let requestListElement = null;
let allRequests = [];

// Generate cURL command from request
function generateCurl(request) {
  let curl = `curl '${request.url}'`;
  
  if (request.method !== 'GET') {
    curl += ` -X ${request.method}`;
  }
  
  if (request.headers) {
    for (const [name, value] of Object.entries(request.headers)) {
      if (name.toLowerCase() !== 'content-length') {
        curl += ` \\\n  -H '${name}: ${value}'`;
      }
    }
  }
  
  if (request.body) {
    const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    curl += ` \\\n  -d '${bodyStr.replace(/'/g, "\\'")}'`;
  }
  
  return curl;
}

// Render request list
function renderRequestList() {
  if (!requestListElement) return;
  
  if (allRequests.length === 0) {
    requestListElement.innerHTML = '<div style="padding: 15px; text-align: center; color: #888; font-size: 11px;">Chưa có request nào</div>';
    return;
  }
  
  requestListElement.innerHTML = allRequests.map((req, index) => {
    const methodClass = `method-${req.method}`;
    const shortUrl = req.url.length > 40 ? req.url.substring(0, 40) + '...' : req.url;
    return `
      <div class="request-item" data-index="${index}">
        <span class="request-method ${methodClass}">${req.method}</span>
        <span class="request-url" title="${req.url}">${shortUrl}</span>
        <div class="request-actions">
          <button class="btn-copy" title="Copy cURL" data-action="copy">📋</button>
          <button class="btn-test" title="Test trong API Tester" data-action="test">🚀</button>
          <button class="btn-del" title="Xóa" data-action="delete">✕</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  requestListElement.querySelectorAll('.request-item').forEach(item => {
    item.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(item.dataset.index);
        const action = btn.dataset.action;
        const request = allRequests[index];
        
        if (action === 'copy') {
          const curl = generateCurl(request);
          navigator.clipboard.writeText(curl).then(() => {
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = '📋', 1000);
          });
        } else if (action === 'test') {
          // Open API Tester với request này
          const curl = generateCurl(request);
          chrome.storage.local.set({ pendingCurl: curl }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('api-tester.html') });
          });
        } else if (action === 'delete') {
          allRequests.splice(index, 1);
          chrome.runtime.sendMessage({ action: 'updateRequests', requests: allRequests }, () => {
            renderRequestList();
            updateRequestCount();
          });
        }
      });
    });
  });
}

// Global updateRequestCount function
function updateRequestCount() {
  if (!requestCountElement) return;
  
  chrome.runtime.sendMessage({ action: 'getRecordedRequests' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('[Popup] Background script not ready yet');
      const recordedText = messages.requestsRecorded || 'requests recorded';
      requestCountElement.innerHTML = `0 <span data-i18n="requestsRecorded">${recordedText}</span>`;
      if (exportCurlBtn) exportCurlBtn.disabled = true;
      if (exportJMeterBtn) exportJMeterBtn.disabled = true;
      allRequests = [];
      renderRequestList();
      return;
    }
    
    if (!response || !response.requests) {
      const recordedText = messages.requestsRecorded || 'requests recorded';
      requestCountElement.innerHTML = `0 <span data-i18n="requestsRecorded">${recordedText}</span>`;
      if (exportCurlBtn) exportCurlBtn.disabled = true;
      if (exportJMeterBtn) exportJMeterBtn.disabled = true;
      allRequests = [];
      renderRequestList();
      return;
    }
    
    allRequests = response.requests;
    const count = response.requests.length;
    const recordedText = messages.requestsRecorded || 'requests recorded';
    requestCountElement.innerHTML = `${count} <span data-i18n="requestsRecorded">${recordedText}</span>`;
    if (exportCurlBtn) exportCurlBtn.disabled = count === 0;
    if (exportJMeterBtn) exportJMeterBtn.disabled = count === 0;
    renderRequestList();
  });
}

async function loadLanguage(lang) {
  try {
    const response = await fetch(`locales/${lang}.json`);
    messages = await response.json();
    currentLang = lang;
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (messages[key]) {
        el.textContent = messages[key];
      }
    });
    
    // Update elements with data-i18n-html attribute (allow HTML)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (messages[key]) {
        el.innerHTML = messages[key];
      }
    });
    
    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (messages[key]) {
        el.placeholder = messages[key];
      }
    });
    
    // Update select options with data-i18n
    document.querySelectorAll('select option[data-i18n]').forEach(option => {
      const key = option.getAttribute('data-i18n');
      if (messages[key]) {
        option.textContent = messages[key];
      }
    });
    
    // Save language preference
    chrome.storage.local.set({ language: lang });
    
    // Update request count text
    updateRequestCount();
  } catch (error) {
    console.error('Failed to load language:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const recordBtn = document.getElementById('recordBtn');
  const domainFilter = document.getElementById('domainFilter');
  const languageSelect = document.getElementById('languageSelect');
  const showIndicatorToggle = document.getElementById('showIndicatorToggle');
  const copyModeToggle = document.getElementById('copyModeToggle');
  const showCopyIndicatorToggle = document.getElementById('showCopyIndicatorToggle');
  const versionDisplay = document.getElementById('versionDisplay');
  
  // Translate Mode elements
  const translateModeToggle = document.getElementById('translateModeToggle');
  const showTranslateIndicatorToggle = document.getElementById('showTranslateIndicatorToggle');
  const translateOnHoverToggle = document.getElementById('translateOnHoverToggle');
  const translateTargetLang = document.getElementById('translateTargetLang');
  
  // Google Sheets Highlighter elements
  const sheetsHighlightToggle = document.getElementById('sheetsHighlightToggle');
  const highlightModeSelect = document.getElementById('highlightModeSelect');
  const highlightColorPicker = document.getElementById('highlightColorPicker');
  const highlightColorValue = document.getElementById('highlightColorValue');
  
  // Hiển thị version từ manifest
  if (versionDisplay) {
    const manifest = chrome.runtime.getManifest();
    versionDisplay.textContent = 'v' + manifest.version;
  }
  
  // Set global references
  exportCurlBtn = document.getElementById('exportCurl');
  exportJMeterBtn = document.getElementById('exportJMeter');
  requestCountElement = document.getElementById('requestCount');
  requestListElement = document.getElementById('requestList');
  
  // Toggle request list visibility
  const toggleRequestListBtn = document.getElementById('toggleRequestList');
  if (toggleRequestListBtn) {
    toggleRequestListBtn.addEventListener('click', () => {
      if (requestListElement.style.display === 'none') {
        requestListElement.style.display = 'block';
        toggleRequestListBtn.textContent = '📋 Ẩn';
      } else {
        requestListElement.style.display = 'none';
        toggleRequestListBtn.textContent = '📋 Xem';
      }
    });
  }
  
  // Load saved language
  chrome.storage.local.get(['language'], (result) => {
    const savedLang = result.language || 'vi';
    languageSelect.value = savedLang;
    loadLanguage(savedLang);
  });
  
  // Language selector change
  languageSelect.addEventListener('change', () => {
    loadLanguage(languageSelect.value);
  });

  // Load saved state
  chrome.storage.local.get(['isEnabled', 'isRecording', 'domainFilter', 'showIndicator', 'copyModeEnabled', 'showCopyIndicator', 'translateModeEnabled', 'showTranslateIndicator', 'translateOnHover', 'translateTargetLang', 'sheetsHighlightEnabled', 'highlightMode', 'highlightColor'], (result) => {
    toggleBtn.checked = result.isEnabled || false;
    recordBtn.checked = result.isRecording || false;
    
    // Load show/hide indicator state
    const showIndicator = result.showIndicator !== undefined ? result.showIndicator : true;
    showIndicatorToggle.checked = showIndicator;
    
    // Load copy mode state
    copyModeToggle.checked = result.copyModeEnabled || false;
    
    // Load show copy indicator state
    const showCopyIndicator = result.showCopyIndicator !== undefined ? result.showCopyIndicator : true;
    showCopyIndicatorToggle.checked = showCopyIndicator;
    
    // Load translate mode state
    if (translateModeToggle) {
      translateModeToggle.checked = result.translateModeEnabled || false;
    }
    if (showTranslateIndicatorToggle) {
      showTranslateIndicatorToggle.checked = result.showTranslateIndicator !== undefined ? result.showTranslateIndicator : true;
    }
    if (translateOnHoverToggle) {
      translateOnHoverToggle.checked = result.translateOnHover || false;
    }
    if (translateTargetLang) {
      translateTargetLang.value = result.translateTargetLang || 'en';
    }
    
    // Load Sheets Highlight state
    if (sheetsHighlightToggle) {
      sheetsHighlightToggle.checked = result.sheetsHighlightEnabled || false;
    }
    if (highlightModeSelect) {
      highlightModeSelect.value = result.highlightMode || 'row';
    }
    if (highlightColorPicker) {
      highlightColorPicker.value = result.highlightColor || '#fff3cd';
      if (highlightColorValue) {
        highlightColorValue.textContent = result.highlightColor || '#fff3cd';
      }
    }
    
    // Nếu chưa có domain filter, lấy domain của tab hiện tại
    if (!result.domainFilter || result.domainFilter === '') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
          try {
            const url = new URL(tabs[0].url);
            domainFilter.value = url.hostname;
            chrome.storage.local.set({ domainFilter: url.hostname });
          } catch (e) {
            domainFilter.value = '';
          }
        }
      });
    } else {
      domainFilter.value = result.domainFilter;
    }
  });

  // Initial count with delay
  setTimeout(updateRequestCount, 500);

  // Update count every 2 seconds when recording
  setInterval(() => {
    if (recordBtn.checked) {
      updateRequestCount();
    }
  }, 2000);

  // Save state on change - Keep Alive
  toggleBtn.addEventListener('change', () => {
    const isEnabled = toggleBtn.checked;
    chrome.storage.local.set({ isEnabled: isEnabled });
  });

  // Toggle show/hide indicator (floating assistant)
  showIndicatorToggle.addEventListener('change', () => {
    const showIndicator = showIndicatorToggle.checked;
    chrome.storage.local.set({ showIndicator: showIndicator });
    
    // Gửi message tới content script để ẩn/hiện indicator (có xử lý lỗi)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleIndicator', 
          show: showIndicator 
        }).catch(() => {
          console.log('[Popup] Content script not ready, using storage instead');
        });
      }
    });
  });

  // Toggle Copy Mode
  copyModeToggle.addEventListener('change', () => {
    const copyModeEnabled = copyModeToggle.checked;
    chrome.storage.local.set({ copyModeEnabled: copyModeEnabled });
    
    // Gửi message tới content script để bật/tắt copy mode (có xử lý lỗi)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleCopyMode', 
          enabled: copyModeEnabled 
        }).catch(() => {
          console.log('[Popup] Content script not ready, using storage instead');
        });
      }
    });
  });

  // Checkbox hiển thị nút Copy Mode trên trang
  showCopyIndicatorToggle.addEventListener('change', () => {
    const showCopyIndicator = showCopyIndicatorToggle.checked;
    chrome.storage.local.set({ showCopyIndicator: showCopyIndicator });
  });

  // ==================== TRANSLATE MODE ====================
  
  // Toggle Translate Mode
  if (translateModeToggle) {
    translateModeToggle.addEventListener('change', () => {
      const translateModeEnabled = translateModeToggle.checked;
      chrome.storage.local.set({ translateModeEnabled: translateModeEnabled });
      
      // Gửi message tới content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'toggleTranslateMode', 
            enabled: translateModeEnabled 
          }).catch(() => {
            console.log('[Popup] Content script not ready, using storage instead');
          });
        }
      });
    });
  }
  
  // Checkbox hiển thị nút Translate Mode trên trang
  if (showTranslateIndicatorToggle) {
    showTranslateIndicatorToggle.addEventListener('change', () => {
      const showTranslateIndicator = showTranslateIndicatorToggle.checked;
      chrome.storage.local.set({ showTranslateIndicator: showTranslateIndicator });
    });
  }
  
  // Checkbox tự động dịch khi hover
  if (translateOnHoverToggle) {
    translateOnHoverToggle.addEventListener('change', () => {
      const translateOnHover = translateOnHoverToggle.checked;
      chrome.storage.local.set({ translateOnHover: translateOnHover });
    });
  }
  
  // Chọn ngôn ngữ đích
  if (translateTargetLang) {
    translateTargetLang.addEventListener('change', () => {
      chrome.storage.local.set({ translateTargetLang: translateTargetLang.value });
    });
  }

  // ==================== GOOGLE SHEETS HIGHLIGHTER ====================
  
  // Toggle Sheets Highlight
  if (sheetsHighlightToggle) {
    sheetsHighlightToggle.addEventListener('change', () => {
      const enabled = sheetsHighlightToggle.checked;
      chrome.storage.local.set({ sheetsHighlightEnabled: enabled });
    });
  }
  
  // Chọn chế độ highlight
  if (highlightModeSelect) {
    highlightModeSelect.addEventListener('change', () => {
      chrome.storage.local.set({ highlightMode: highlightModeSelect.value });
    });
  }
  
  // Chọn màu highlight
  if (highlightColorPicker) {
    highlightColorPicker.addEventListener('input', () => {
      const color = highlightColorPicker.value;
      chrome.storage.local.set({ highlightColor: color });
      if (highlightColorValue) {
        highlightColorValue.textContent = color;
      }
    });
  }
  
  // ==================== CHAT NOTIFIER ====================
  
  // Save state on change - Recording
  recordBtn.addEventListener('change', () => {
    const isRecording = recordBtn.checked;
    
    // Nếu bật recording, kiểm tra xem DevTools có đang mở không
    if (isRecording) {
      // Gửi message đến content script để check DevTools
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'checkDevTools' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('[Popup] Cannot communicate with content script');
              // Vẫn cho phép bật recording
              chrome.storage.local.set({ isRecording: isRecording });
              return;
            }
            
            if (response && !response.isOpen) {
              // DevTools chưa mở, hiện cảnh báo
              chrome.tabs.sendMessage(tabs[0].id, { action: 'showF12Reminder' });
            }
            
            chrome.storage.local.set({ isRecording: isRecording });
          });
        } else {
          chrome.storage.local.set({ isRecording: isRecording });
        }
      });
    } else {
      chrome.storage.local.set({ isRecording: isRecording });
      updateRequestCount();
    }
  });

  // Save domain filter
  domainFilter.addEventListener('input', () => {
    chrome.storage.local.set({ domainFilter: domainFilter.value });
  });

  // Button to get current tab domain
  document.getElementById('getCurrentDomain').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          domainFilter.value = url.hostname;
          chrome.storage.local.set({ domainFilter: url.hostname });
        } catch (e) {
          alert('Không thể lấy domain từ tab này');
        }
      }
    });
  });

  // Export cURL
  exportCurlBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'exportCurl' }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Lỗi: ' + chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success) {
        alert('Đã export cURL commands!');
      } else if (response && response.error) {
        alert(response.error);
      }
    });
  });

  // Export JMeter
  exportJMeterBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'exportJMeter' }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Lỗi: ' + chrome.runtime.lastError.message);
        return;
      }
      if (response && response.success) {
        alert('Đã export JMeter file!');
      } else if (response && response.error) {
        alert(response.error);
      }
    });
  });

  // Clear all requests
  document.getElementById('clearRequests').addEventListener('click', () => {
    if (confirm('Xóa tất cả requests đã record?')) {
      chrome.runtime.sendMessage({ action: 'clearRequests' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('Lỗi: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response && response.success) {
          updateRequestCount();
         
        }
      });
    }
  });

  // ==================== API TESTER ====================
  
  // Open API Tester in new tab
  const openApiTesterBtn = document.getElementById('openApiTester');
  if (openApiTesterBtn) {
    openApiTesterBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('api-tester.html') });
    });
  }

  // ==================== ZABBIX CHARTS DOWNLOADER ====================
  
  const zabbixChartCount = document.getElementById('zabbixChartCount');
  const downloadZabbixImages = document.getElementById('downloadZabbixImages');
  const downloadZabbixPdf = document.getElementById('downloadZabbixPdf');
  const zabbixStatusContainer = document.getElementById('zabbixDownloadStatusContainer');

  // Check if current page has Zabbix charts
  function checkZabbixCharts() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const charts = document.querySelectorAll('#charts img, .flickerfreescreen img');
          return charts.length;
        }
      }).then(results => {
        const count = results[0]?.result || 0;
        if (count > 0) {
          const chartsText = messages.chartsFound || 'charts';
          zabbixChartCount.textContent = `(${count} ${chartsText})`;
          zabbixChartCount.style.color = '#4CAF50';
        } else {
          zabbixChartCount.textContent = messages.noCharts || '(Không có charts)';
          zabbixChartCount.style.color = '#999';
        }
      }).catch(() => {
        zabbixChartCount.textContent = '';
      });
    });
  }

  // Hiển thị tất cả tasks vào container (nhiều dòng)
  function renderZabbixTasks(tasks) {
    if (!zabbixStatusContainer) return;
    
    const taskEntries = Object.entries(tasks);
    if (taskEntries.length === 0) {
      zabbixStatusContainer.innerHTML = '';
      return;
    }
    
    const html = taskEntries.map(([taskId, task]) => {
      const typeLabel = task.type === 'images' ? '📥 Ảnh' : '📄 PDF';
      let statusText = '';
      let statusClass = '';
      
      if (task.active) {
        statusText = `⏳ ${task.current}/${task.total} (${task.percent}%)`;
        statusClass = '';
      } else if (task.completed && task.success) {
        if (task.type === 'images') {
          statusText = `✅ Đã tải ${task.current} ảnh`;
        } else {
          statusText = `✅ Thu thập ${task.current} charts`;
        }
        statusClass = 'success';
      } else if (task.error) {
        statusText = `❌ ${task.error}`;
        statusClass = 'error';
      }
      
      return `<div class="download-status show ${statusClass}" style="margin: 4px 0; padding: 6px 10px; font-size: 11px;">
        <strong>${typeLabel}</strong>: ${statusText}
      </div>`;
    }).join('');
    
    zabbixStatusContainer.innerHTML = html;
  }
  
  // Poll trạng thái download từ background
  let pollIntervalId = null;
  
  function pollZabbixStatus() {
    // Dừng poll cũ nếu có
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }
    
    pollIntervalId = setInterval(() => {
      chrome.runtime.sendMessage({ action: 'getZabbixDownloadStatus' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
          return;
        }
        
        const tasks = response.tasks || {};
        renderZabbixTasks(tasks);
        
        // Kiểm tra xem còn task nào đang active không
        const hasActiveTasks = Object.values(tasks).some(t => t.active);
        if (!hasActiveTasks) {
          // Dừng poll sau 3 giây nếu không còn active task
          setTimeout(() => {
            if (pollIntervalId) {
              clearInterval(pollIntervalId);
              pollIntervalId = null;
            }
          }, 3000);
        }
      });
    }, 500);
    
    // Dừng poll sau 120 giây để tránh chạy mãi
    setTimeout(() => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    }, 120000);
  }
  
  // Kiểm tra trạng thái download khi popup mở
  function checkZabbixDownloadStatus() {
    chrome.runtime.sendMessage({ action: 'getZabbixDownloadStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      
      const tasks = response.tasks || {};
      const hasAnyTasks = Object.keys(tasks).length > 0;
      
      if (hasAnyTasks) {
        renderZabbixTasks(tasks);
        // Nếu có task đang active thì bắt đầu poll
        const hasActiveTasks = Object.values(tasks).some(t => t.active);
        if (hasActiveTasks) {
          pollZabbixStatus();
        }
      }
    });
  }

  // Download all images - gọi background script để chạy ngầm
  downloadZabbixImages.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      
      // Gọi background script để xử lý
      chrome.runtime.sendMessage({ action: 'zabbixDownloadImages', tabId: tabId }, (response) => {
        if (response?.success) {
          // Bắt đầu poll ngay
          pollZabbixStatus();
        }
      });
    });
  });

  // Download as PDF - gọi background script để chạy ngầm
  downloadZabbixPdf.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      
      // Gọi background script để xử lý
      chrome.runtime.sendMessage({ action: 'zabbixExportPdf', tabId: tabId }, (response) => {
        if (response?.success) {
          // Bắt đầu poll ngay
          pollZabbixStatus();
        }
      });
    });
  });

  // Check for charts when popup opens + check download status
  checkZabbixCharts();
  checkZabbixDownloadStatus();

  // ==================== SCRIPT LOADER FUNCTIONS ====================
  let currentScripts = [];
  
  // Default script URL
  const DEFAULT_SCRIPT_URL = 'https://github.com/rakusvn-dhan/tests/blob/master/scripts/absence_calculator.js';

  // Load scripts from storage, add default if empty
  async function loadScripts() {
    chrome.runtime.sendMessage({ action: 'getScripts' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading scripts:', chrome.runtime.lastError);
        return;
      }
      currentScripts = response || [];
      
      // If no scripts, auto-add default script
      if (currentScripts.length === 0) {
        addDefaultScript();
        return;
      }
      
      renderScriptList();
      updateScriptCount();
      checkForScriptUpdates();
    });
  }
  
  // Add default script automatically
  function addDefaultScript() {
    chrome.runtime.sendMessage({ action: 'addScript', data: { url: DEFAULT_SCRIPT_URL } }, (response) => {
      if (response?.success) {
        console.log('[ScriptLoader] Default script added:', response.script.name);
        // Reload scripts
        chrome.runtime.sendMessage({ action: 'getScripts' }, (resp) => {
          currentScripts = resp || [];
          renderScriptList();
          updateScriptCount();
          checkForScriptUpdates();
        });
      } else {
        console.error('[ScriptLoader] Failed to add default script:', response?.error);
        renderScriptList();
        updateScriptCount();
      }
    });
  }

  // Render script list
  function renderScriptList() {
    const scriptList = document.getElementById('scriptList');
    if (!scriptList) return;

    if (currentScripts.length === 0) {
      scriptList.innerHTML = '<div style="padding: 15px; text-align: center; color: #888; font-size: 11px;">Chưa có script nào</div>';
      return;
    }

    scriptList.innerHTML = currentScripts.map(script => {
      const matchDisplay = (script.matches && script.matches.length > 0) 
        ? script.matches[0] 
        : script.domain || 'All sites';
      const updateBadge = script.hasUpdate ? '<span class="script-update-badge">NEW</span>' : '';
      const hasVars = script.variables && script.variables.length > 0;
      const editIcon = hasVars ? '⚙️' : '✏️';
      const editTitle = hasVars ? 'Cấu hình biến' : 'Sửa';
      
      return `
        <div class="script-item">
          <div class="script-info">
            <div class="script-name" title="${script.name}">${script.name}</div>
            <div class="script-match" title="${matchDisplay}">🌐 ${matchDisplay}</div>
            <div class="script-meta">
              <span class="script-version">v${script.version || '1.0'}</span>
              ${hasVars ? '<span style="background:#e8f5e9;color:#388e3c;padding:1px 4px;border-radius:3px;font-size:9px;">⚙️ ' + script.variables.length + ' vars</span>' : ''}
              ${updateBadge}
            </div>
          </div>
          <div class="script-toggle ${script.enabled ? 'active' : ''}" data-id="${script.id}" title="${script.enabled ? 'Tắt' : 'Bật'}"></div>
          <div class="script-actions">
            ${script.hasUpdate ? `<button class="btn-update" data-id="${script.id}" data-action="update" title="Cập nhật">⬆️</button>` : ''}
            <button class="btn-edit" data-id="${script.id}" data-action="edit" title="${editTitle}">${editIcon}</button>
            <button class="btn-remove" data-id="${script.id}" data-action="remove" title="Xóa">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    scriptList.querySelectorAll('.script-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const scriptId = toggle.dataset.id;
        const script = currentScripts.find(s => s.id === scriptId);
        if (script) {
          const newState = !script.enabled;
          chrome.runtime.sendMessage({ 
            action: 'toggleScript', 
            scriptId: scriptId, 
            enabled: newState 
          }, () => {
            loadScripts();
          });
        }
      });
    });

    scriptList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const scriptId = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'update') {
          updateScript(scriptId);
        } else if (action === 'edit') {
          editScript(scriptId);
        } else if (action === 'remove') {
          if (confirm(messages['confirmRemoveScript'] || 'Xóa script này?')) {
            chrome.runtime.sendMessage({ action: 'removeScript', scriptId: scriptId }, () => {
              loadScripts();
            });
          }
        }
      });
    });
  }

  // Update script count
  function updateScriptCount() {
    const countEl = document.getElementById('scriptCount');
    if (countEl) {
      const count = currentScripts.length;
      const label = messages['scriptsInstalled'] || 'script(s) đã cài';
      countEl.innerHTML = `${count} <span data-i18n="scriptsInstalled">${label}</span>`;
    }
  }

  // Check for updates
  function checkForScriptUpdates() {
    const updatesAvailable = currentScripts.filter(s => s.hasUpdate).length;
    const notifEl = document.getElementById('scriptUpdateNotif');
    const countEl = document.getElementById('scriptUpdateCount');
    
    if (updatesAvailable > 0) {
      notifEl.style.display = 'block';
      countEl.textContent = updatesAvailable;
    } else {
      notifEl.style.display = 'none';
    }
  }

  // Update single script
  function updateScript(scriptId) {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳';
    
    chrome.runtime.sendMessage({ action: 'updateScript', scriptId: scriptId }, (response) => {
      if (response?.success) {
        loadScripts();
      } else {
        alert(response?.error || 'Update failed');
        btn.disabled = false;
        btn.textContent = '⬆️';
      }
    });
  }

  // Edit script - show configurable variables modal
  function editScript(scriptId) {
    chrome.runtime.sendMessage({ action: 'getScriptById', scriptId: scriptId }, (script) => {
      if (!script) return;
      
      // Check if script has configurable variables
      if (script.variables && script.variables.length > 0) {
        showVariablesModal(script);
      } else {
        // Fallback to simple URL edit
        const newUrl = prompt('Script URL:', script.url || script.sourceUrl || '');
        if (newUrl && newUrl !== script.url) {
          chrome.runtime.sendMessage({ action: 'removeScript', scriptId: scriptId }, () => {
            chrome.runtime.sendMessage({ action: 'addScript', data: { url: newUrl } }, () => {
              loadScripts();
            });
          });
        }
      }
    });
  }

  // Show variables modal for editing script config
  function showVariablesModal(script) {
    // Remove existing modal
    const existingModal = document.getElementById('scriptVarsModal');
    if (existingModal) existingModal.remove();
    
    const modalHtml = `
      <div id="scriptVarsModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 8px; padding: 15px; width: 90%; max-width: 350px; max-height: 80%; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 14px;">⚙️ ${script.name}</h3>
            <button id="closeVarsModal" style="border: none; background: none; font-size: 18px; cursor: pointer;">✕</button>
          </div>
          <div style="font-size: 10px; color: #666; margin-bottom: 10px;">
            v${script.version} | ${script.matches[0] || 'All sites'}
          </div>
          <div id="varsContainer">
            ${script.variables.map((v, i) => `
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 11px; color: #333; font-weight: bold; margin-bottom: 3px;">
                  ${v.name}
                </label>
                <input type="text" 
                       data-var-index="${i}" 
                       data-var-name="${v.name}"
                       value="${v.value}" 
                       style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                <div style="font-size: 9px; color: #888; margin-top: 2px;">${v.description}</div>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 15px;">
            <button id="saveVarsBtn" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              💾 Lưu
            </button>
            <button id="cancelVarsBtn" style="flex: 1; padding: 8px; background: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 12px;">
              Hủy
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Close modal handlers
    document.getElementById('closeVarsModal').onclick = () => document.getElementById('scriptVarsModal').remove();
    document.getElementById('cancelVarsBtn').onclick = () => document.getElementById('scriptVarsModal').remove();
    document.getElementById('scriptVarsModal').onclick = (e) => {
      if (e.target.id === 'scriptVarsModal') document.getElementById('scriptVarsModal').remove();
    };
    
    // Save handler
    document.getElementById('saveVarsBtn').onclick = () => {
      const inputs = document.querySelectorAll('#varsContainer input');
      const newVariables = Array.from(inputs).map(input => ({
        name: input.dataset.varName,
        value: input.value,
        description: script.variables[parseInt(input.dataset.varIndex)].description
      }));
      
      chrome.runtime.sendMessage({ 
        action: 'updateScriptVariables', 
        scriptId: script.id, 
        variables: newVariables 
      }, (response) => {
        if (response?.success) {
          document.getElementById('scriptVarsModal').remove();
          loadScripts();
          alert('✅ Đã lưu! Reload trang để áp dụng thay đổi.');
        } else {
          alert(response?.error || 'Lỗi khi lưu');
        }
      });
    };
  }

  // Add script button
  document.getElementById('addScript')?.addEventListener('click', () => {
    const urlInput = document.getElementById('scriptUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
      alert(messages['enterScriptUrl'] || 'Vui lòng nhập URL script');
      return;
    }

    const btn = document.getElementById('addScript');
    btn.disabled = true;
    btn.textContent = '⏳';
    
    chrome.runtime.sendMessage({ action: 'addScript', data: { url: url } }, (response) => {
      if (response?.success) {
        urlInput.value = '';
        loadScripts();
      } else {
        alert(response?.error || 'Failed to add script');
      }
      btn.disabled = false;
      btn.textContent = messages['add'] || 'Thêm';
    });
  });

  // Check updates button
  document.getElementById('checkScriptUpdates')?.addEventListener('click', () => {
    const btn = document.getElementById('checkScriptUpdates');
    btn.textContent = '⏳';
    btn.disabled = true;
    
    chrome.runtime.sendMessage({ action: 'checkForUpdates' }, (response) => {
      loadScripts();
      btn.textContent = '🔄';
      btn.disabled = false;
      
      if (response?.updatesFound > 0) {
        alert(`${response.updatesFound} bản cập nhật có sẵn!`);
      }
    });
  });

  // Update all scripts button
  document.getElementById('updateAllScripts')?.addEventListener('click', () => {
    const scriptsToUpdate = currentScripts.filter(s => s.hasUpdate);
    
    scriptsToUpdate.forEach(script => {
      chrome.runtime.sendMessage({ action: 'updateScript', scriptId: script.id });
    });
    
    setTimeout(() => {
      loadScripts();
    }, 1000);
  });

  // Toggle script list visibility
  document.getElementById('toggleScriptList')?.addEventListener('click', () => {
    const scriptList = document.getElementById('scriptList');
    if (scriptList.style.display === 'none') {
      scriptList.style.display = 'block';
    } else {
      scriptList.style.display = 'none';
    }
  });

  // Load scripts on popup open
  loadScripts();
});