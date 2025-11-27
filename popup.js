// I18n system
let currentLang = 'vi';
let messages = {};

// Global reference to UI elements (will be set in DOMContentLoaded)
let requestCountElement = null;
let exportCurlBtn = null;
let exportJMeterBtn = null;

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
      return;
    }
    
    if (!response || !response.requests) {
      const recordedText = messages.requestsRecorded || 'requests recorded';
      requestCountElement.innerHTML = `0 <span data-i18n="requestsRecorded">${recordedText}</span>`;
      if (exportCurlBtn) exportCurlBtn.disabled = true;
      if (exportJMeterBtn) exportJMeterBtn.disabled = true;
      return;
    }
    
    const count = response.requests.length;
    const recordedText = messages.requestsRecorded || 'requests recorded';
    requestCountElement.innerHTML = `${count} <span data-i18n="requestsRecorded">${recordedText}</span>`;
    if (exportCurlBtn) exportCurlBtn.disabled = count === 0;
    if (exportJMeterBtn) exportJMeterBtn.disabled = count === 0;
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
  
  // Set global references
  exportCurlBtn = document.getElementById('exportCurl');
  exportJMeterBtn = document.getElementById('exportJMeter');
  requestCountElement = document.getElementById('requestCount');
  
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
  chrome.storage.local.get(['isEnabled', 'isRecording', 'domainFilter', 'showIndicator'], (result) => {
    toggleBtn.checked = result.isEnabled || false;
    recordBtn.checked = result.isRecording || false;
    
    // Load show/hide indicator state
    const showIndicator = result.showIndicator !== undefined ? result.showIndicator : true;
    showIndicatorToggle.checked = showIndicator;
    
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
    
    // Gửi message tới content script để ẩn/hiện indicator
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleIndicator', 
          show: showIndicator 
        });
      }
    });
  });

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
});