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
  const zabbixDownloadStatus = document.getElementById('zabbixDownloadStatus');

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
          zabbixChartCount.textContent = `(${count} charts)`;
          zabbixChartCount.style.color = '#4CAF50';
        } else {
          zabbixChartCount.textContent = '(Không có charts)';
          zabbixChartCount.style.color = '#999';
        }
      }).catch(() => {
        zabbixChartCount.textContent = '';
      });
    });
  }

  // Show status
  function showZabbixStatus(message, type = '') {
    zabbixDownloadStatus.textContent = message;
    zabbixDownloadStatus.className = 'download-status show ' + type;
  }

  // Download all images
  downloadZabbixImages.addEventListener('click', () => {
    showZabbixStatus('⏳ Đang tải...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: async () => {
          const images = document.querySelectorAll('#charts img, .flickerfreescreen img');
          if (images.length === 0) {
            return { success: false, error: 'Không tìm thấy charts' };
          }
          
          let downloaded = 0;
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = img.src;
            
            let name = 'chart_' + (i + 1);
            const graphMatch = src.match(/graphid=(\d+)/);
            const itemMatch = src.match(/itemids%5B%5D=(\d+)/);
            
            if (graphMatch) name = 'graph_' + graphMatch[1];
            else if (itemMatch) name = 'item_' + itemMatch[1];
            
            try {
              const response = await fetch(src);
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              
              const a = document.createElement('a');
              a.href = url;
              a.download = name + '.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              downloaded++;
              await new Promise(r => setTimeout(r, 300));
            } catch (e) {
              console.error('Error downloading:', name, e);
            }
          }
          
          return { success: true, count: downloaded };
        }
      }).then(results => {
        const result = results[0]?.result;
        if (result?.success) {
          showZabbixStatus(`✅ Đã tải ${result.count} ảnh!`, 'success');
        } else {
          showZabbixStatus('❌ ' + (result?.error || 'Lỗi'), 'error');
        }
      }).catch(err => {
        showZabbixStatus('❌ ' + err.message, 'error');
      });
    });
  });

  // Download as PDF - collect images and open PDF generator page
  downloadZabbixPdf.addEventListener('click', () => {
    showZabbixStatus('⏳ Đang thu thập ảnh...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: async () => {
          const images = document.querySelectorAll('#charts img, .flickerfreescreen img');
          if (images.length === 0) {
            return { success: false, error: 'Không tìm thấy charts' };
          }
          
          const chartData = [];
          
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = img.src;
            
            let name = 'Chart ' + (i + 1);
            const graphMatch = src.match(/graphid=(\d+)/);
            const itemMatch = src.match(/itemids%5B%5D=(\d+)/);
            if (graphMatch) name = 'Graph ID: ' + graphMatch[1];
            else if (itemMatch) name = 'Item ID: ' + itemMatch[1];
            
            try {
              const response = await fetch(src);
              const blob = await response.blob();
              const base64 = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              
              chartData.push({ name, base64 });
            } catch (e) {
              console.error('Error fetching:', name, e);
            }
          }
          
          return { success: true, charts: chartData };
        }
      }).then(results => {
        const result = results[0]?.result;
        if (result?.success && result.charts?.length > 0) {
          // Save to storage and open PDF generator
          chrome.storage.local.set({ zabbixCharts: result.charts }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('zabbix-pdf.html') });
            showZabbixStatus(`✅ Thu thập ${result.charts.length} charts, đang mở PDF...`, 'success');
          });
        } else {
          showZabbixStatus('❌ ' + (result?.error || 'Không có charts'), 'error');
        }
      }).catch(err => {
        showZabbixStatus('❌ ' + err.message, 'error');
      });
    });
  });

  // Check for charts when popup opens
  checkZabbixCharts();
});