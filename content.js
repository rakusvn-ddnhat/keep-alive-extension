let isEnabled = false;
let isRecording = false;
let currentLang = 'vi';
let messages = {};
let showIndicator = true; // Trạng thái hiển thị indicator
let copyModeEnabled = false; // Trạng thái Copy Mode
let copyModeActive = false; // Flag để track xem Copy Mode đã thực sự được bật chưa
let showCopyIndicator = true; // Hiển thị nút Copy Mode trên trang
let lastHoveredElement = null; // Element cuối cùng được hover
let copyDebounceTimer = null; // Timer để debounce copy

// ==================== TRANSLATE MODE VARIABLES ====================
let translateModeEnabled = false; // Trạng thái Translate Mode
let translateModeActive = false; // Flag để track xem Translate Mode đã thực sự được bật chưa
let showTranslateIndicator = true; // Hiển thị nút Translate Mode trên trang
let translateOnHover = false; // Tự động dịch khi hover (không cần click)
let translateTargetLang = 'en'; // Ngôn ngữ đích (en, vi)
let lastTranslateElement = null; // Element cuối cùng được hover trong Translate Mode
let translateDebounceTimer = null; // Timer để debounce translate
let bergamotLoaded = false; // Bergamot WASM đã load chưa
let bergamotWorker = null; // Web Worker cho Bergamot
let translationCache = {}; // Cache kết quả dịch

// ==================== WEB CROSSHAIR VARIABLES ====================
let sheetsHighlightEnabled = false;
let highlightMode = 'row'; // row, column, both
let highlightColor = '#e10e0e';
let sheetsHighlightActive = false;
let currentHighlightedCells = [];
let showCrosshairIndicator = true;

// ==================== CHAT AI BUBBLE VARIABLES ====================
let chatBubbleEnabled = false;
let showChatBubble = true;
let chatAiService = 'gemini';

// Chỉ chạy trong top frame, không chạy trong iframe
const isTopFrame = (window === window.top);

// Helper function để kiểm tra extension context còn valid không
function isExtensionValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// Safe wrapper cho chrome.storage.local.get
function safeStorageGet(keys, callback) {
  try {
    if (!isExtensionValid()) {
      console.log('[Keep Alive] Extension context invalid, skipping storage.get');
      return;
    }
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.log('[Keep Alive] Storage get error:', chrome.runtime.lastError.message);
        return;
      }
      callback(result);
    });
  } catch (e) {
    console.log('[Keep Alive] Storage get failed:', e.message);
  }
}

// Safe wrapper cho chrome.storage.local.set
function safeStorageSet(data) {
  try {
    if (!isExtensionValid()) {
      console.log('[Keep Alive] Extension context invalid, skipping storage.set');
      return;
    }
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        console.log('[Keep Alive] Storage set error:', chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    console.log('[Keep Alive] Storage set failed:', e.message);
  }
}

console.log('[Keep Alive] Extension loaded, isTopFrame:', isTopFrame);

// Load language messages
async function loadLanguage(lang) {
  try {
    const response = await fetch(chrome.runtime.getURL(`locales/${lang}.json`));
    messages = await response.json();
    currentLang = lang;
    console.log('[Keep Alive] Language loaded:', lang);
  } catch (error) {
    console.error('[Keep Alive] Failed to load language:', error);
  }
}

// Load saved language and showIndicator state
safeStorageGet(['language', 'showIndicator', 'copyModeEnabled', 'showCopyIndicator', 'translateModeEnabled', 'showTranslateIndicator', 'translateOnHover', 'translateTargetLang', 'sheetsHighlightEnabled', 'highlightMode', 'highlightColor', 'showCrosshairIndicator', 'apiTesterEnabled', 'showApiTesterIndicator', 'chatBubbleEnabled', 'showChatBubble', 'chatAiService'], (result) => {
  const savedLang = result.language || 'vi';
  loadLanguage(savedLang);
  
  // Load showIndicator state (default true)
  showIndicator = result.showIndicator !== undefined ? result.showIndicator : true;
  
  // Load showCopyIndicator state (default true)
  showCopyIndicator = result.showCopyIndicator !== undefined ? result.showCopyIndicator : true;
  
  // Load copyModeEnabled state (default false) - CHẠY Ở TẤT CẢ FRAMES
  copyModeEnabled = result.copyModeEnabled || false;
  
  // Load Translate Mode states
  translateModeEnabled = result.translateModeEnabled || false;
  showTranslateIndicator = result.showTranslateIndicator !== undefined ? result.showTranslateIndicator : true;
  translateOnHover = result.translateOnHover || false;
  translateTargetLang = result.translateTargetLang || 'en';
  
  // Load Google Sheets Highlighter states
  sheetsHighlightEnabled = result.sheetsHighlightEnabled || false;
  highlightMode = result.highlightMode || 'row';
  highlightColor = result.highlightColor || '#fff3cd';
  showCrosshairIndicator = result.showCrosshairIndicator !== false;
  
  // Load Chat AI Bubble states
  chatBubbleEnabled = result.chatBubbleEnabled || false;
  showChatBubble = result.showChatBubble !== false;
  chatAiService = result.chatAiService || 'gemini';
  
  // LUÔN tạo indicator ở top frame (để người dùng có thể click bật/tắt)
  // Sau đó mới ẩn/hiện dựa trên showCopyIndicator
  if (isTopFrame) {
    try { initCopyModeIndicator(); } catch(e) { console.error('[Keep Alive] initCopyModeIndicator error:', e); }
    try { initTranslateModeIndicator(); } catch(e) { console.error('[Keep Alive] initTranslateModeIndicator error:', e); }
    try { initCrosshairIndicator(); } catch(e) { console.error('[Keep Alive] initCrosshairIndicator error:', e); }
    try { initChatBubbleIndicator(); } catch(e) { console.error('[Keep Alive] initChatBubbleIndicator error:', e); }
  }
  
  // LUÔN thêm CSS highlight vào TẤT CẢ FRAMES (kể cả frame con)
  addCopyModeHighlightStyle();
  addTranslateModeHighlightStyle();
  addSheetsHighlightStyle(); // Thêm CSS cho Google Sheets
  
  // Nếu Copy Mode đang bật, enable nó (add event listeners)
  if (copyModeEnabled) {
    // Kiểm tra DOM ready - hỗ trợ cả frameset
    const isDOMReady = () => {
      return document.body || document.documentElement || document.readyState !== 'loading';
    };
    
    if (isDOMReady()) {
      enableCopyMode();
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => enableCopyMode(), { once: true });
    } else {
      // Fallback
      const waitForDOM = setInterval(() => {
        if (isDOMReady()) {
          clearInterval(waitForDOM);
          enableCopyMode();
        }
      }, 50);
    }
  }
  
  // Nếu Translate Mode đang bật, enable nó
  if (translateModeEnabled) {
    const isDOMReady = () => {
      return document.body || document.documentElement || document.readyState !== 'loading';
    };
    
    if (isDOMReady()) {
      enableTranslateMode();
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => enableTranslateMode(), { once: true });
    } else {
      const waitForDOM = setInterval(() => {
        if (isDOMReady()) {
          clearInterval(waitForDOM);
          enableTranslateMode();
        }
      }, 50);
    }
  }
  
  // Nếu Web Crosshair đang bật - hoạt động trên mọi trang web
  if (sheetsHighlightEnabled) {
    enableSheetsHighlight();
  }
  
  // Nếu API Tester đang bật - chỉ top frame
  const apiTesterEnabled = result.apiTesterEnabled || false;
  const showApiTesterIndicatorFlag = result.showApiTesterIndicator !== false;
  if (apiTesterEnabled && isTopFrame) {
    const isDOMReady = () => {
      return document.body || document.documentElement || document.readyState !== 'loading';
    };
    
    if (isDOMReady()) {
      injectApiTesterPanel(showApiTesterIndicatorFlag);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => injectApiTesterPanel(showApiTesterIndicatorFlag), { once: true });
    } else {
      const waitForDOM = setInterval(() => {
        if (isDOMReady()) {
          clearInterval(waitForDOM);
          injectApiTesterPanel(showApiTesterIndicatorFlag);
        }
      }, 50);
    }
  }
  
  // Ẩn/hiện indicator dựa trên setting
  const indicator = document.getElementById('nhat-debug-indicator');
  if (indicator) {
    indicator.style.display = showIndicator ? 'block' : 'none';
  }
});

// Listen for language changes and showIndicator changes
try {
  if (isExtensionValid()) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (!isExtensionValid()) return; // Skip if extension invalidated
      
      if (namespace === 'local' && changes.language) {
        loadLanguage(changes.language.newValue);
      }
      
      if (namespace === 'local' && changes.showIndicator) {
        showIndicator = changes.showIndicator.newValue;
        const indicator = document.getElementById('nhat-debug-indicator');
        if (indicator) {
          indicator.style.display = showIndicator ? 'block' : 'none';
        }
      }
      
      if (namespace === 'local' && changes.copyModeEnabled) {
        // Xử lý Copy Mode ở TẤT CẢ FRAMES
        copyModeEnabled = changes.copyModeEnabled.newValue;
        console.log('[Keep Alive] Storage changed - copyModeEnabled:', copyModeEnabled);
        if (copyModeEnabled) {
          enableCopyMode();
        } else {
          disableCopyMode();
        }
      }
      
      if (namespace === 'local' && changes.showCopyIndicator) {
        showCopyIndicator = changes.showCopyIndicator.newValue;
        const indicator = document.getElementById('nhat-copy-mode-indicator');
        if (indicator) {
          indicator.style.display = showCopyIndicator ? 'block' : 'none';
          indicator.style.visibility = showCopyIndicator ? 'visible' : 'hidden';
        }
      }
      
      // ==================== TRANSLATE MODE STORAGE CHANGES ====================
      if (namespace === 'local' && changes.translateModeEnabled) {
        translateModeEnabled = changes.translateModeEnabled.newValue;
        console.log('[Keep Alive] Storage changed - translateModeEnabled:', translateModeEnabled);
        if (translateModeEnabled) {
          enableTranslateMode();
        } else {
          disableTranslateMode();
        }
      }
      
      if (namespace === 'local' && changes.showTranslateIndicator) {
        showTranslateIndicator = changes.showTranslateIndicator.newValue;
        const indicator = document.getElementById('nhat-translate-mode-indicator');
        if (indicator) {
          indicator.style.display = showTranslateIndicator ? 'block' : 'none';
          indicator.style.visibility = showTranslateIndicator ? 'visible' : 'hidden';
        }
      }
      
      if (namespace === 'local' && changes.translateOnHover) {
        translateOnHover = changes.translateOnHover.newValue;
        console.log('[Keep Alive] translateOnHover changed to:', translateOnHover);
      }
      
      if (namespace === 'local' && changes.translateTargetLang) {
        translateTargetLang = changes.translateTargetLang.newValue;
        console.log('[Keep Alive] translateTargetLang changed to:', translateTargetLang);
      }
      
      // ==================== WEB CROSSHAIR STORAGE CHANGES ====================
      if (namespace === 'local' && changes.sheetsHighlightEnabled) {
        sheetsHighlightEnabled = changes.sheetsHighlightEnabled.newValue;
        console.log('[Keep Alive] webCrosshairEnabled changed to:', sheetsHighlightEnabled);
        if (sheetsHighlightEnabled) {
          enableSheetsHighlight();
        } else {
          disableSheetsHighlight();
        }
        updateCrosshairIndicatorState();
      }
      
      if (namespace === 'local' && changes.showCrosshairIndicator) {
        showCrosshairIndicator = changes.showCrosshairIndicator.newValue;
        console.log('[Keep Alive] showCrosshairIndicator changed to:', showCrosshairIndicator);
        const indicator = document.getElementById('ka-crosshair-indicator');
        if (indicator) {
          indicator.style.display = showCrosshairIndicator ? 'block' : 'none';
        }
      }
      
      if (namespace === 'local' && changes.highlightMode) {
        highlightMode = changes.highlightMode.newValue;
        console.log('[Keep Alive] highlightMode changed to:', highlightMode);
      }
      
      if (namespace === 'local' && changes.highlightColor) {
        highlightColor = changes.highlightColor.newValue;
        console.log('[Keep Alive] highlightColor changed to:', highlightColor);
        updateSheetsHighlightColor();
      }
    });
  }
} catch (e) {
  console.log('[Keep Alive] Could not add storage listener:', e.message);
}

// Detect xem DevTools có đang mở không
let isDevToolsOpen = false;



// Check initial state
isDevToolsOpen = false; // Mặc định là chưa mở

// Hiển thị notification nhắc nhở mở F12
function showF12Reminder() {
  // Kiểm tra xem đã có notification chưa
  if (document.getElementById('nhat-f12-reminder')) {
    return;
  }
  
  const openDevToolsText = messages.openDevTools || 'Vui lòng mở F12';
  const openDevToolsDescText = messages.openDevToolsDesc || 'để xem requests trong DevTools';
  
  let closeText = 'Đóng (hoặc tự động đóng sau 10s)';
  if (currentLang === 'en') {
    closeText = 'Close (auto-close after 10s)';
  } else if (currentLang === 'ja') {
    closeText = '閉じる（10秒後に自動的に閉じます）';
  }
  
  const reminder = document.createElement('div');
  reminder.id = 'nhat-f12-reminder';
  reminder.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
      <div style="font-size: 48px;">⌨️</div>
      <div style="font-size: 24px; font-weight: bold;">${openDevToolsText}</div>
      <div style="font-size: 16px; opacity: 0.9;">${openDevToolsDescText}</div>
      <div style="font-size: 12px; opacity: 0.7; margin-top: 10px; cursor: pointer; padding: 5px 10px; background: rgba(255,255,255,0.2); border-radius: 5px;" onclick="this.parentElement.parentElement.remove()">
        ${closeText}
      </div>
    </div>
  `;
  reminder.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.95), rgba(255, 87, 34, 0.95));
    color: white;
    padding: 40px 60px;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 99999999;
    font-family: Arial, sans-serif;
    text-align: center;
    animation: popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  `;
  
  // Thêm CSS animation
  if (!document.getElementById('nhat-f12-reminder-style')) {
    const style = document.createElement('style');
    style.id = 'nhat-f12-reminder-style';
    style.textContent = `
      @keyframes popIn {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.05); }
      }
      #nhat-f12-reminder {
        animation: popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), pulse 2s ease-in-out infinite 0.4s;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(reminder);
  console.log('[Keep Alive] F12 reminder shown');
  
  // Tự động xóa sau 10 giây
  setTimeout(() => {
    if (reminder.parentElement) {
      reminder.remove();
    }
  }, 10000);
}

// Tạo nút DevTools nổi
function createDevToolsButton() {
  // Kiểm tra body đã ready chưa
  if (!document.body) {
    console.log('[Keep Alive] Body not ready, waiting for DevTools button...');
    setTimeout(createDevToolsButton, 100);
    return;
  }
  
  // Kiểm tra xem đã có nút chưa
  if (document.getElementById('nhat-devtools-button')) {
    console.log('[Keep Alive] DevTools button already exists');
    return;
  }
  
  const button = document.createElement('div');
  button.id = 'nhat-devtools-button';
  button.dataset.devtoolsOpen = 'false'; // Track trạng thái
  
  const openDevToolsText = messages.openDevTools || 'Mở DevTools (F12)';
  const openDevToolsDesc = messages.openDevToolsDesc || 'nếu muốn xem requests trong tab Network';
  
  button.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
      <span style="font-size: 16px;">🔧</span>
      <span id="nhat-devtools-text" style="font-size: 10px; font-weight: bold; line-height: 1.2; text-align: center;">${openDevToolsText}<br>${openDevToolsDesc}</span>
    </div>
  `;
  button.style.cssText = `
    position: fixed;
    top: 150px;
    right: 20px;
    background: rgba(255, 152, 0, 0.95);
    color: white;
    padding: 10px 14px;
    border-radius: 15px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 999998;
    font-family: Arial, sans-serif;
    cursor: move;
    user-select: none;
    transition: none;
    animation: pulse 2s ease-in-out infinite;
  `;
  
  // Drag and drop functionality
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  // Load vị trí đã lưu từ localStorage
  const savedPosition = localStorage.getItem('nhat-devtools-button-position');
  if (savedPosition) {
    const pos = JSON.parse(savedPosition);
    xOffset = pos.x;
    yOffset = pos.y;
    button.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
  }
  
  button.addEventListener('mousedown', (e) => {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    button.style.animation = 'none'; // Tắt animation khi drag
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      button.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      button.style.animation = 'pulse 2s ease-in-out infinite'; // Bật lại animation
      
      // Lưu vị trí vào localStorage
      localStorage.setItem('nhat-devtools-button-position', JSON.stringify({
        x: xOffset,
        y: yOffset
      }));
    }
  });
  


  
  // Thêm CSS animation
  if (!document.getElementById('nhat-devtools-style')) {
    const style = document.createElement('style');
    style.id = 'nhat-devtools-style';
    style.textContent = `
      @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(0.8); }
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
        50% { box-shadow: 0 4px 20px rgba(255, 152, 0, 0.6); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(button);
  console.log('[Keep Alive] DevTools button created');
}

// Xóa nút DevTools
function removeDevToolsButton() {
  const button = document.getElementById('nhat-devtools-button');
  if (button) {
    button.remove();
    console.log('[Keep Alive] DevTools button removed');
  }
}

// Tạo floating indicator
function createFloatingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'nhat-debug-indicator';
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 5px;">
      <div id="nhat-record-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #ccc;"></div>
      <span id="nhat-record-text" style="font-size: 11px; font-weight: bold;">OFF</span>
      <span id="nhat-record-count" style="font-size: 10px; opacity: 0.9; display: none;">0</span>
    </div>
  `;
  indicator.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(33, 150, 243, 0.95);
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: Arial, sans-serif;
    cursor: move;
    user-select: none;
    transition: all 0.3s ease;
    display: ${showIndicator ? 'block' : 'none'};
  `;
  
  // Thêm chức năng kéo thả
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  // Load vị trí đã lưu từ localStorage
  try {
    const savedPosition = localStorage.getItem('nhat-debug-indicator-position');
    if (savedPosition) {
      const pos = JSON.parse(savedPosition);
      xOffset = pos.x;
      yOffset = pos.y;
      indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  } catch (e) {
    console.log('[Keep Alive] Could not load saved position');
  }
  
  indicator.addEventListener('mousedown', (e) => {
    if (e.target === indicator || indicator.contains(e.target)) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      
      indicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      
      // Lưu vị trí mới vào localStorage
      try {
        localStorage.setItem('nhat-debug-indicator-position', JSON.stringify({
          x: xOffset,
          y: yOffset
        }));
        console.log('[Keep Alive] Saved indicator position:', xOffset, yOffset);
      } catch (e) {
        console.log('[Keep Alive] Could not save position');
      }
    }
  });
  
  indicator.addEventListener('click', (e) => {
    // Chỉ xử lý click nếu không đang kéo
    if (Math.abs(xOffset) < 5 && Math.abs(yOffset) < 5) {
      try {
        chrome.runtime.sendMessage({ action: 'getRecordedRequests' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('[Keep Alive] Extension context lost, please reload page');
            return;
          }
          if (response && response.requests) {
            alert(`🎯 Nhất Debug Tool\n\nRecording: ${isRecording ? 'ON' : 'OFF'}\nRequests: ${response.requests.length}\nDomain: ${window.location.hostname}`);
          }
        });
      } catch (e) {
        console.log('[Keep Alive] Extension reloaded, please refresh page');
      }
    }
  });
  
  document.body.appendChild(indicator);
  return indicator;
}

function updateIndicator(requestCount) {
  let indicator = document.getElementById('nhat-debug-indicator');
  if (!indicator && document.body) {
    indicator = createFloatingIndicator();
  }
  
  if (indicator) {
    const dot = document.getElementById('nhat-record-dot');
    const text = document.getElementById('nhat-record-text');
    const count = document.getElementById('nhat-record-count');
    
    if (isRecording) {
      dot.style.background = '#ff4444';
      dot.style.animation = 'pulse 1.5s ease-in-out infinite';
      text.textContent = 'REC';
      indicator.style.background = 'rgba(255, 68, 68, 0.95)';
      
      // Hiển thị số lượng request
      if (typeof requestCount === 'number') {
        count.style.display = 'inline';
        count.textContent = `(${requestCount})`;
      }
    } else {
      dot.style.background = '#ccc';
      dot.style.animation = 'none';
      text.textContent = 'OFF';
      indicator.style.background = 'rgba(33, 150, 243, 0.95)';
      count.style.display = 'none';
    }
  }
}

// Kiểm tra xem extension context có còn valid không
function isExtensionContextValid() {
  try {
    return !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Cập nhật số lượng request định kỳ khi đang recording
function startRequestCounter() {
  setInterval(() => {
    if (!isRecording || !isExtensionContextValid()) {
      return;
    }
    
    try {
      chrome.runtime.sendMessage({ action: 'getRecordedRequests' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          return;
        }
        if (response.requests) {
          updateIndicator(response.requests.length);
        }
      });
    } catch (e) {
      // Extension context invalid, bỏ qua
    }
  }, 2000); // Cập nhật mỗi 2 giây
}

// Khởi động counter
if (isExtensionContextValid()) {
  startRequestCounter();
}

// Thêm CSS animation cho pulse
function addPulseAnimation() {
  if (!document.head) {
    setTimeout(addPulseAnimation, 50);
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
  `;
  document.head.appendChild(style);
}
addPulseAnimation();

function handleBeforeUnload(event) {
  console.log('[Keep Alive] beforeunload triggered, isEnabled:', isEnabled);
  
  if (!isEnabled) {
    console.log('[Keep Alive] Extension is OFF, allowing close');
    return;
  }

  console.log('[Keep Alive] Extension is ON, blocking close');
  event.preventDefault();
  event.returnValue = 'Bạn có chắc muốn đóng không?';
  debugger;
}

// Hàm khởi tạo indicator
function initIndicator() {
  console.log('[Keep Alive] Trying to create indicator, document.body exists:', !!document.body);
  if (document.body) {
    updateIndicator();
    console.log('[Keep Alive] Indicator created');
  } else {
    console.log('[Keep Alive] Body not ready, waiting...');
    setTimeout(initIndicator, 100);
  }
}

// Kiểm tra trạng thái khi load trang
safeStorageGet(['isEnabled', 'isRecording'], (result) => {
  isEnabled = result.isEnabled || false;
  isRecording = result.isRecording || false;
  console.log('[Keep Alive] Initial state - isEnabled:', isEnabled, 'isRecording:', isRecording);
  
  if (isEnabled) {
    window.addEventListener('beforeunload', handleBeforeUnload);
    console.log('[Keep Alive] Event listener added');
  }
  
  // Hiện nút DevTools nếu "Chặn đóng tab" đang bật
  if (isEnabled) {
    console.log('[Keep Alive] Initial "Chặn đóng tab" is ON, creating DevTools button...');
    createDevToolsButton();
  } else {
    console.log('[Keep Alive] Initial "Chặn đóng tab" is OFF, no DevTools button');
  }
  
  // Tạo indicator
  initIndicator();
});

// Lắng nghe thay đổi từ popup
try {
  if (isExtensionValid()) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (!isExtensionValid()) return; // Skip if extension invalidated
      
      if (namespace === 'local') {
        if (changes.isEnabled) {
          isEnabled = changes.isEnabled.newValue;
          console.log('[Keep Alive] State changed to:', isEnabled);
          
          if (isEnabled) {
            window.addEventListener('beforeunload', handleBeforeUnload);
            console.log('[Keep Alive] Event listener added');
            
            // Hiện nút DevTools khi bật "Chặn đóng tab"
            console.log('[Keep Alive] Calling createDevToolsButton()...');
            createDevToolsButton();
          } else {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            console.log('[Keep Alive] Event listener removed');
            
            // Ẩn nút DevTools khi tắt "Chặn đóng tab"
            console.log('[Keep Alive] Calling removeDevToolsButton()...');
            removeDevToolsButton();
          }
        }
        
        if (changes.isRecording) {
          isRecording = changes.isRecording.newValue;
          console.log('[Keep Alive] Recording state changed to:', isRecording);
          
          // Chỉ update indicator, không ẩn/hiện nút DevTools
          if (isRecording) {
            try {
              if (isExtensionValid()) {
                chrome.runtime.sendMessage({ action: 'getRecordedRequests' }, (response) => {
                  if (chrome.runtime.lastError) return;
                  if (response && response.requests) {
                    updateIndicator(response.requests.length);
                  }
                });
              }
            } catch (e) {
              // Extension context invalid
            }
          } else {
            updateIndicator();
          }
        }
      }
    });
  }
} catch (e) {
  console.log('[Keep Alive] Could not add storage listener:', e.message);
}

// Lắng nghe message từ popup để check DevTools state
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ alive: true });
    return true;
  }

  if (request.action === 'checkDevTools') {
    // Trả về trạng thái hiện tại của DevTools
    sendResponse({ isOpen: isDevToolsOpen });
    return true;
  }
  
  if (request.action === 'showF12Reminder') {
    // Hiển thị reminder
    showF12Reminder();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'toggleIndicator') {
    // Ẩn/hiện indicator
    showIndicator = request.show;
    const indicator = document.getElementById('nhat-debug-indicator');
    if (indicator) {
      indicator.style.display = showIndicator ? 'block' : 'none';
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'toggleCopyMode') {
    // Bật/tắt Copy Mode ở TẤT CẢ FRAMES
    copyModeEnabled = request.enabled;
    if (copyModeEnabled) {
      enableCopyMode();
    } else {
      disableCopyMode();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'toggleTranslateMode') {
    // Bật/tắt Translate Mode ở TẤT CẢ FRAMES
    translateModeEnabled = request.enabled;
    if (translateModeEnabled) {
      enableTranslateMode();
    } else {
      disableTranslateMode();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'injectApiTester') {
    // Inject API Tester panel vào trang (bypass CORS)
    console.log('[Keep Alive] Received injectApiTester, isTopFrame:', isTopFrame);
    
    if (isTopFrame) {
      try {
        injectApiTesterPanel();
        sendResponse({ success: true, message: 'Injected successfully' });
      } catch (e) {
        console.error('[Keep Alive] Inject error:', e);
        sendResponse({ success: false, error: e.message });
      }
    } else {
      sendResponse({ success: false, error: 'Only inject in top frame' });
    }
    return true;
  }
  
  if (request.action === 'toggleApiTester') {
    console.log('[Keep Alive] toggleApiTester:', request.enabled, 'isTopFrame:', isTopFrame);
    
    if (isTopFrame) {
      try {
        if (request.enabled) {
          injectApiTesterPanel(request.showIndicator);
        } else {
          removeApiTesterPanel();
        }
        sendResponse({ success: true });
      } catch (e) {
        console.error('[Keep Alive] Toggle API Tester error:', e);
        sendResponse({ success: false, error: e.message });
      }
    } else {
      sendResponse({ success: false, error: 'Only toggle in top frame' });
    }
    return true;
  }
  
  if (request.action === 'updateApiTesterIndicator') {
    if (isTopFrame && apiTesterIndicator) {
      apiTesterIndicator.style.display = request.show ? 'block' : 'none';
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'startScreenshotSelection') {
    if (!isTopFrame) {
      sendResponse({ started: false, error: 'Not top frame' });
      return true;
    }
    try {
      if (typeof window.__screenshotStartCallback === 'function') {
        window.__screenshotStartCallback(request.scale || 2, request.saveFile || false);
        sendResponse({ started: true });
      } else {
        sendResponse({ started: false, error: 'Screenshot module not loaded' });
      }
    } catch (e) {
      sendResponse({ started: false, error: e.message });
    }
    return true;
  }

  if (request.action === 'toggleScreenshotIndicator') {
    if (isTopFrame && typeof window.__screenshotToggleIndicator === 'function') {
      window.__screenshotToggleIndicator(request.show);
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'toggleChatBubble') {
    if (isTopFrame && typeof window.__chatBubbleToggle === 'function') {
      window.__chatBubbleToggle(request.enabled);
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'toggleChatBubbleVisibility') {
    if (isTopFrame && typeof window.__chatBubbleSetVisible === 'function') {
      window.__chatBubbleSetVisible(request.show);
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'updateChatAiService') {
    if (isTopFrame && typeof window.__chatBubbleSetService === 'function') {
      window.__chatBubbleSetService(request.service);
    }
    sendResponse({ success: true });
    return true;
  }
});

// ==================== INJECTED API TESTER ====================

let apiTesterPanel = null;
let apiTesterIndicator = null;
let apiTesterInjected = false;

function injectApiTesterPanel(showIndicator = true) {
  // Nếu đã inject rồi, toggle hiển thị panel
  if (apiTesterInjected) {
    if (apiTesterPanel) apiTesterPanel.style.display = 'flex';
    if (apiTesterIndicator && showIndicator) apiTesterIndicator.style.display = 'block';
    return;
  }
  
  // Chờ DOM ready
  function doInject() {
    // Kiểm tra xem có phải frameset không
    const isFrameset = document.querySelector('frameset') !== null;
    
    let container = document.body;
    
    // Nếu là frameset page, cần tạo overlay div đặc biệt
    if (isFrameset || !document.body) {
      console.log('[Keep Alive] Detected frameset page, creating overlay...');
      
      // Tạo container overlay cho frameset
      let overlay = document.getElementById('nhat-api-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'nhat-api-overlay';
        overlay.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
        `;
        (document.documentElement || document.body).appendChild(overlay);
      }
      container = overlay;
    }
    
    if (!container) {
      console.log('[Keep Alive] Waiting for DOM...');
      setTimeout(doInject, 100);
      return;
    }
    
    console.log('[Keep Alive] Injecting API Tester into:', container.tagName || container.id);
    
    // Thêm style
    addApiTesterStyles();
    
    // Tạo indicator (nút toggle ẩn/hiện) - cho phép click
    createApiTesterIndicator(container);
    
    // Tạo panel container
    apiTesterPanel = document.createElement('div');
    apiTesterPanel.id = 'nhat-api-tester-panel';
    apiTesterPanel.innerHTML = getApiTesterHTML();
    apiTesterPanel.style.pointerEvents = 'auto'; // Cho phép interact
    
    // Append vào container
    container.appendChild(apiTesterPanel);
    
    // Setup event listeners
    setupApiTesterEvents();
    
    // Đánh dấu đã inject
    apiTesterInjected = true;
    
    // Hiển thị thông báo thành công với tên domain
    const domain = window.location.hostname;
    showApiTesterNotification(`✅ API Tester đã inject vào: ${domain}`);
    
    console.log('[Keep Alive] API Tester panel injected successfully on:', domain);
  }
  
  doInject();
}

// Remove API Tester panel khi tắt toggle
function removeApiTesterPanel() {
  console.log('[Keep Alive] Removing API Tester panel...');
  
  // Xóa panel
  if (apiTesterPanel) {
    apiTesterPanel.remove();
    apiTesterPanel = null;
  } else {
    const panel = document.getElementById('nhat-api-tester-panel');
    if (panel) panel.remove();
  }
  
  // Xóa indicator
  if (apiTesterIndicator) {
    apiTesterIndicator.remove();
    apiTesterIndicator = null;
  } else {
    const indicator = document.getElementById('nhat-api-tester-indicator');
    if (indicator) indicator.remove();
  }
  
  // Xóa overlay nếu có (cho frameset page)
  const overlay = document.getElementById('nhat-api-overlay');
  if (overlay) overlay.remove();
  
  // Xóa style
  const style = document.getElementById('nhat-api-tester-styles');
  if (style) style.remove();
  
  // Reset trạng thái
  apiTesterInjected = false;
  
  console.log('[Keep Alive] API Tester removed');
}

function createApiTesterIndicator(container) {
  // Nếu indicator đã tồn tại thì bỏ qua
  if (document.getElementById('nhat-api-tester-indicator')) return;
  
  const domain = window.location.hostname;
  const shortDomain = domain.length > 15 ? domain.substring(0, 12) + '...' : domain;
  
  apiTesterIndicator = document.createElement('div');
  apiTesterIndicator.id = 'nhat-api-tester-indicator';
  apiTesterIndicator.style.pointerEvents = 'auto'; // Cho phép click trên overlay
  apiTesterIndicator.innerHTML = `
    <span class="nhat-api-ind-icon">🚀</span>
    <span class="nhat-api-ind-text">API</span>
    <span class="nhat-api-ind-domain">${shortDomain}</span>
  `;
  apiTesterIndicator.title = `API Tester trên ${domain} - Click để ẩn/hiện`;
  
  // Click để toggle panel
  apiTesterIndicator.addEventListener('click', toggleApiTesterPanel);
  
  container.appendChild(apiTesterIndicator);
  console.log('[Keep Alive] API Tester indicator created');
}

function toggleApiTesterPanel() {
  if (!apiTesterPanel) return;
  
  const isHidden = apiTesterPanel.classList.contains('nhat-hidden');
  apiTesterPanel.classList.toggle('nhat-hidden', !isHidden);
  
  // Update indicator style - xanh khi panel hiện, xám khi panel ẩn
  if (apiTesterIndicator) {
    apiTesterIndicator.classList.toggle('inactive', !isHidden);
  }
  console.log('[Keep Alive] API Tester panel toggled, visible:', isHidden);
}

function showApiTesterNotification(message) {
  // Lấy overlay nếu có, không thì dùng body
  let container = document.getElementById('nhat-api-overlay') || document.body || document.documentElement;
  if (!container) return;
  
  // Xóa notification cũ nếu có
  const existing = document.getElementById('nhat-api-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'nhat-api-notification';
  notification.style.pointerEvents = 'auto';
  notification.innerHTML = `
    <span>${message}</span>
    <div style="font-size: 10px; margin-top: 4px; opacity: 0.8;">
      Click nút 🚀 API ở góc màn hình để ẩn/hiện
    </div>
  `;
  
  container.appendChild(notification);
  
  // Auto remove sau 4 giây
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function getApiTesterHTML() {
  return `
    <div class="nhat-api-header">
      <span class="nhat-api-title">🚀 API Tester (Injected - No CORS)</span>
      <div class="nhat-api-header-btns">
        <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-load-records" title="Load từ Record Requests">📂 Records</button>
        <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-import-curl" title="Import cURL">📥 cURL</button>
        <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-import-list" title="Import JSON list">📁 List</button>
        <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-history" title="Lịch sử">📜</button>
        <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-clear" title="Xóa">🗑️</button>
        <button class="nhat-api-btn nhat-api-btn-maximize" id="nhat-api-maximize" title="Phóng to">🗖</button>
        <button class="nhat-api-btn nhat-api-btn-minimize" id="nhat-api-minimize" title="Thu nhỏ">➖</button>
        <button class="nhat-api-btn nhat-api-btn-close" id="nhat-api-close" title="Đóng">✕</button>
      </div>
    </div>
    <div class="nhat-api-body" id="nhat-api-body">
      <!-- Request Bar -->
      <div class="nhat-api-request-bar">
        <select id="nhat-api-method" class="nhat-api-method">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <input type="text" id="nhat-api-url" class="nhat-api-url" placeholder="Enter URL (hoặc path tương đối: /api/users)">
        <button id="nhat-api-send" class="nhat-api-btn nhat-api-btn-primary">Send</button>
      </div>
      
      <!-- Request Options -->
      <div class="nhat-api-section">
        <div class="nhat-api-tabs">
          <button class="nhat-api-tab active" data-tab="headers">Headers</button>
          <button class="nhat-api-tab" data-tab="body">Body</button>
          <button class="nhat-api-tab" data-tab="auth">Auth</button>
        </div>
        
        <div class="nhat-api-tab-content" id="nhat-api-headers-tab">
          <div class="nhat-api-kv-editor" id="nhat-api-headers-editor">
            <div class="nhat-api-kv-row">
              <input type="checkbox" class="nhat-api-kv-check" checked>
              <input type="text" class="nhat-api-kv-key" placeholder="Header name">
              <input type="text" class="nhat-api-kv-value" placeholder="Value">
              <button class="nhat-api-kv-delete">✕</button>
            </div>
          </div>
          <button class="nhat-api-add-row" id="nhat-api-add-header">+ Add Header</button>
        </div>
        
        <div class="nhat-api-tab-content" id="nhat-api-body-tab" style="display:none;">
          <div class="nhat-api-body-types">
            <label><input type="radio" name="nhat-body-type" value="none" checked> None</label>
            <label><input type="radio" name="nhat-body-type" value="json"> JSON</label>
            <label><input type="radio" name="nhat-body-type" value="form"> Form</label>
            <label><input type="radio" name="nhat-body-type" value="raw"> Raw</label>
          </div>
          <textarea id="nhat-api-body-editor" class="nhat-api-body-editor" placeholder='{"key": "value"}'></textarea>
        </div>
        
        <div class="nhat-api-tab-content" id="nhat-api-auth-tab" style="display:none;">
          <select id="nhat-api-auth-type" class="nhat-api-auth-select">
            <option value="none">No Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="apikey">API Key</option>
          </select>
          <div id="nhat-api-auth-fields"></div>
        </div>
      </div>
      
      <!-- Response -->
      <div class="nhat-api-section nhat-api-response-section">
        <div class="nhat-api-response-header">
          <span>Response</span>
          <span id="nhat-api-status" class="nhat-api-status"></span>
          <span id="nhat-api-time" class="nhat-api-time"></span>
          <span id="nhat-api-size" class="nhat-api-size"></span>
        </div>
        <div class="nhat-api-response-tabs">
          <button class="nhat-api-resp-tab active" data-response-tab="body">Body</button>
          <button class="nhat-api-resp-tab" data-response-tab="headers">Headers</button>
          <button class="nhat-api-resp-tab" data-response-tab="cookies">Cookies</button>
        </div>
        <div class="nhat-api-view-modes" id="nhat-api-view-modes">
          <button class="nhat-api-view-btn active" data-view="pretty">Pretty</button>
          <button class="nhat-api-view-btn" data-view="raw">Raw</button>
          <button class="nhat-api-view-btn" data-view="preview">Preview</button>
        </div>
        <div id="nhat-api-response-body" class="nhat-api-response-body">
          <div class="nhat-api-empty-state">Click Send để gửi request</div>
        </div>
        <div id="nhat-api-response-headers" class="nhat-api-response-headers" style="display:none;"></div>
        <div id="nhat-api-response-cookies" class="nhat-api-response-cookies" style="display:none;"></div>
      </div>
    </div>
    
    <!-- Import cURL Modal -->
    <div class="nhat-api-modal" id="nhat-api-curl-modal" style="display:none;">
      <div class="nhat-api-modal-content">
        <div class="nhat-api-modal-header">
          <span>📥 Import cURL</span>
          <button class="nhat-api-modal-close" id="nhat-api-curl-cancel">✕</button>
        </div>
        <textarea id="nhat-api-curl-input" class="nhat-api-curl-input" placeholder="Paste cURL command here..."></textarea>
        <div class="nhat-api-modal-actions">
          <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-curl-cancel2">Hủy</button>
          <button class="nhat-api-btn nhat-api-btn-primary" id="nhat-api-curl-import">Import</button>
        </div>
      </div>
    </div>
    
    <!-- Records Modal -->
    <div class="nhat-api-modal" id="nhat-api-records-modal" style="display:none;">
      <div class="nhat-api-modal-content nhat-api-modal-large">
        <div class="nhat-api-modal-header">
          <span>📂 Load Records</span>
          <button class="nhat-api-modal-close" id="nhat-api-records-close">✕</button>
        </div>
        <div id="nhat-api-records-list" class="nhat-api-records-list">
          <div class="nhat-api-empty-state">Đang tải...</div>
        </div>
      </div>
    </div>
    
    <!-- History Modal -->
    <div class="nhat-api-modal" id="nhat-api-history-modal" style="display:none;">
      <div class="nhat-api-modal-content nhat-api-modal-large">
        <div class="nhat-api-modal-header">
          <span>📜 History</span>
          <button class="nhat-api-btn nhat-api-btn-secondary" id="nhat-api-history-clear">🗑️ Clear</button>
          <button class="nhat-api-modal-close" id="nhat-api-history-close">✕</button>
        </div>
        <div id="nhat-api-history-list" class="nhat-api-history-list">
          <div class="nhat-api-empty-state">Chưa có lịch sử</div>
        </div>
      </div>
    </div>
    
    <!-- Import List Modal -->
    <div class="nhat-api-modal" id="nhat-api-list-modal" style="display:none;">
      <div class="nhat-api-modal-content nhat-api-modal-large">
        <div class="nhat-api-modal-header">
          <span>📁 Import List</span>
          <button class="nhat-api-modal-close" id="nhat-api-list-close">✕</button>
        </div>
        <input type="file" id="nhat-api-list-file" accept=".json" style="display:none;">
        <button class="nhat-api-btn nhat-api-btn-primary" id="nhat-api-list-select">📁 Chọn file JSON</button>
        <div id="nhat-api-list-items" class="nhat-api-records-list" style="margin-top:10px;"></div>
      </div>
    </div>
  `;
}

function addApiTesterStyles() {
  if (document.getElementById('nhat-api-tester-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'nhat-api-tester-styles';
  style.textContent = `
    /* Indicator (nút toggle) */
    #nhat-api-tester-indicator {
      position: fixed !important;
      bottom: 80px !important;
      right: 15px !important;
      background: linear-gradient(135deg, #0e639c, #1177bb) !important;
      color: white !important;
      padding: 8px 12px !important;
      border-radius: 20px !important;
      cursor: pointer !important;
      z-index: 2147483647 !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-size: 12px !important;
      font-weight: bold !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
      transition: all 0.2s ease !important;
      user-select: none !important;
      border: 2px solid white !important;
    }
    
    #nhat-api-tester-indicator:hover {
      transform: scale(1.05) !important;
      box-shadow: 0 6px 16px rgba(0,0,0,0.6) !important;
    }
    
    #nhat-api-tester-indicator.inactive {
      background: linear-gradient(135deg, #555, #666) !important;
      opacity: 0.7 !important;
    }
    
    .nhat-api-ind-icon {
      font-size: 14px !important;
    }
    
    .nhat-api-ind-domain {
      font-size: 10px !important;
      opacity: 0.8 !important;
      background: rgba(255,255,255,0.2) !important;
      padding: 2px 6px !important;
      border-radius: 10px !important;
    }
    
    /* Notification */
    #nhat-api-notification {
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: linear-gradient(135deg, #388a34, #45a049) !important;
      color: white !important;
      padding: 12px 20px !important;
      border-radius: 8px !important;
      z-index: 2147483647 !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-size: 14px !important;
      font-weight: bold !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
      text-align: center !important;
      transition: opacity 0.3s ease !important;
      border: 2px solid white !important;
    }
    
    /* Panel chính */
    #nhat-api-tester-panel {
      position: fixed !important;
      top: 10px !important;
      right: 10px !important;
      width: 550px !important;
      max-width: calc(100vw - 20px) !important;
      max-height: calc(100vh - 20px) !important;
      background: #1e1e1e !important;
      border: 2px solid #0e639c !important;
      border-radius: 8px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      z-index: 2147483647 !important;
      flex-direction: column !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      font-size: 13px !important;
      color: #d4d4d4 !important;
      resize: both !important;
      overflow: hidden !important;
      display: flex !important;
      transition: all 0.25s cubic-bezier(0.4,0,0.2,1) !important;
    }

    #nhat-api-tester-panel.maximized {
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      border-radius: 0 !important;
      resize: none !important;
      box-shadow: 0 0 0 rgba(0,0,0,0) !important;
    }

    .nhat-api-btn-maximize {
      background: #0e639c;
      color: white;
      padding: 4px 8px;
    }
    .nhat-api-btn-maximize:hover {
      background: #1177bb;
    }
    
    #nhat-api-tester-panel.nhat-hidden {
      display: none !important;
    }
    
    .nhat-api-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 10px 12px !important;
      background: #252526 !important;
      border-bottom: 1px solid #444 !important;
      cursor: move !important;
    }
    
    .nhat-api-title {
      font-weight: bold !important;
      color: #569cd6 !important;
      font-size: 14px;
    }
    
    .nhat-api-header-btns {
      display: flex;
      gap: 6px;
    }
    
    .nhat-api-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .nhat-api-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    
    .nhat-api-btn-primary { background: #0e639c; color: white; }
    .nhat-api-btn-primary:hover { background: #1177bb; }
    .nhat-api-btn-secondary { background: #3c3c3c; color: #d4d4d4; border: 1px solid #555; }
    .nhat-api-btn-secondary:hover { background: #4a4a4a; }
    .nhat-api-btn-close { background: #c42b1c; color: white; padding: 4px 8px; }
    .nhat-api-btn-close:hover { background: #e03e2f; }
    .nhat-api-btn-minimize { background: #555; color: white; padding: 4px 8px; }
    .nhat-api-btn-minimize:hover { background: #666; }
    
    .nhat-api-request-bar {
      display: flex;
      gap: 8px;
    }
    
    .nhat-api-method {
      width: 100px;
      padding: 8px;
      background: #3c3c3c;
      color: #d4d4d4;
      border: 1px solid #555;
      border-radius: 4px;
      font-weight: bold;
    }
    
    .nhat-api-url {
      flex: 1;
      padding: 8px 12px;
      background: #2d2d2d;
      color: #d4d4d4;
      border: 1px solid #555;
      border-radius: 4px;
    }
    
    .nhat-api-url:focus, .nhat-api-method:focus {
      outline: none;
      border-color: #0e639c;
    }
    
    .nhat-api-section {
      background: #252526;
      border-radius: 6px;
      padding: 10px;
    }
    
    .nhat-api-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 10px;
      border-bottom: 1px solid #444;
      padding-bottom: 8px;
    }
    
    .nhat-api-tab {
      padding: 6px 12px;
      background: transparent;
      color: #888;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .nhat-api-tab:hover { color: #d4d4d4; }
    .nhat-api-tab.active { background: #0e639c; color: white; }
    
    .nhat-api-kv-editor {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 120px;
      overflow-y: auto;
    }
    
    .nhat-api-kv-row {
      display: flex;
      gap: 6px;
    }
    
    .nhat-api-kv-key, .nhat-api-kv-value {
      flex: 1;
      padding: 6px 8px;
      background: #2d2d2d;
      color: #d4d4d4;
      border: 1px solid #444;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .nhat-api-kv-delete {
      padding: 4px 8px;
      background: #3c3c3c;
      color: #d4d4d4;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .nhat-api-kv-delete:hover { background: #c42b1c; color: white; }
    
    .nhat-api-add-row {
      margin-top: 8px;
      padding: 6px 12px;
      background: transparent;
      color: #0e639c;
      border: 1px dashed #0e639c;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .nhat-api-add-row:hover { background: rgba(14, 99, 156, 0.1); }
    
    .nhat-api-body-types {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    
    .nhat-api-body-types label {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    
    .nhat-api-body-editor {
      width: 100%;
      min-height: 80px;
      padding: 8px;
      background: #2d2d2d;
      color: #d4d4d4;
      border: 1px solid #444;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      resize: vertical;
    }
    
    .nhat-api-auth-select {
      width: 100%;
      padding: 8px;
      background: #2d2d2d;
      color: #d4d4d4;
      border: 1px solid #444;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    
    #nhat-api-auth-fields input {
      width: 100%;
      padding: 8px;
      background: #2d2d2d;
      color: #d4d4d4;
      border: 1px solid #444;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    
    .nhat-api-response-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 150px;
    }
    
    .nhat-api-response-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-weight: bold;
    }
    
    .nhat-api-status {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
    }
    
    .nhat-api-status.success { background: #388a34; color: white; }
    .nhat-api-status.error { background: #c42b1c; color: white; }
    .nhat-api-status.redirect { background: #ffc107; color: #000; }
    
    .nhat-api-response-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }
    
    .nhat-api-response-body, .nhat-api-response-headers {
      flex: 1;
      background: #2d2d2d;
      border-radius: 4px;
      padding: 10px;
      overflow: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 100px;
      max-height: 250px;
    }
    
    .nhat-api-empty-state {
      color: #888;
      text-align: center;
      padding: 30px;
    }
    
    .nhat-api-loading {
      text-align: center;
      padding: 20px;
      color: #569cd6;
    }
    
    /* JSON Syntax Highlighting */
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
    
    /* Modal */
    .nhat-api-modal {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    
    .nhat-api-modal-content {
      background: #1e1e1e;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 15px;
      width: 90%;
      max-width: 400px;
    }
    
    .nhat-api-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-weight: bold;
    }
    
    .nhat-api-modal-close {
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 16px;
    }
    
    .nhat-api-modal-close:hover { color: #fff; }
    
    .nhat-api-curl-input {
      width: 100%;
      min-height: 100px;
      padding: 10px;
      background: #2d2d2d;
      color: #d4d4d4;
      border: 1px solid #444;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      resize: vertical;
    }
    
    .nhat-api-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    
    .nhat-api-modal-large {
      max-width: 600px !important;
      max-height: 80vh !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
    }
    
    .nhat-api-records-list, .nhat-api-history-list {
      flex: 1 !important;
      overflow-y: auto !important;
      max-height: 400px !important;
      padding: 5px !important;
    }
    
    .nhat-api-record-item, .nhat-api-history-item {
      padding: 10px 12px !important;
      margin-bottom: 6px !important;
      background: #2d2d2d !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      border: 2px solid transparent !important;
    }

    .nhat-api-record-item:hover, .nhat-api-history-item:hover {
      background: #383838 !important;
      border-color: #0e639c !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    }
    
    .nhat-api-record-method {
      display: inline-block !important;
      font-size: 10px !important;
      font-weight: bold !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
      margin-right: 8px !important;
      text-transform: uppercase !important;
    }
    
    .nhat-api-method-GET { background: #1e3a2f !important; color: #4ec9b0 !important; }
    .nhat-api-method-POST { background: #3d3520 !important; color: #dcdcaa !important; }
    .nhat-api-method-PUT { background: #1e2d3d !important; color: #569cd6 !important; }
    .nhat-api-method-DELETE { background: #3d1e1e !important; color: #f14c4c !important; }
    .nhat-api-method-PATCH { background: #3d2d1e !important; color: #ce9178 !important; }
    
    .nhat-api-record-url {
      font-size: 12px !important;
      color: #d4d4d4 !important;
      word-break: break-all !important;
      font-family: 'Consolas', monospace !important;
    }
    
    .nhat-api-record-meta {
      font-size: 10px !important;
      color: #666 !important;
      margin-top: 4px !important;
    }
    
    .nhat-api-view-modes {
      display: flex !important;
      gap: 4px !important;
      padding: 5px 10px !important;
      background: #252526 !important;
      border-bottom: 1px solid #333 !important;
    }
    
    .nhat-api-view-btn {
      padding: 3px 10px !important;
      font-size: 11px !important;
      background: transparent !important;
      border: 1px solid #444 !important;
      color: #888 !important;
      border-radius: 3px !important;
      cursor: pointer !important;
    }
    
    .nhat-api-view-btn.active {
      background: #0e639c !important;
      border-color: #0e639c !important;
      color: white !important;
    }
    
    .nhat-api-view-btn:hover:not(.active) {
      background: #333 !important;
      color: #fff !important;
    }
    
    .nhat-api-time, .nhat-api-size {
      font-size: 11px !important;
      color: #888 !important;
      margin-left: 10px !important;
    }
    
    .nhat-api-response-cookies {
      padding: 10px !important;
      font-family: 'Consolas', monospace !important;
      font-size: 12px !important;
      overflow: auto !important;
      max-height: 150px !important;
    }
    
    .nhat-api-cookie-item {
      padding: 6px 0 !important;
      border-bottom: 1px solid #333 !important;
    }
    
    .nhat-api-cookie-name { color: #9cdcfe !important; }
    .nhat-api-cookie-value { color: #ce9178 !important; }
    
    .nhat-api-resp-tab {
      padding: 6px 12px !important;
      cursor: pointer !important;
      font-size: 11px !important;
      color: #888 !important;
      border: none !important;
      background: transparent !important;
      border-bottom: 2px solid transparent !important;
      transition: all 0.2s !important;
    }
    
    .nhat-api-resp-tab:hover { color: #d4d4d4 !important; background: #333 !important; }
    .nhat-api-resp-tab.active { 
      color: #d4d4d4 !important; 
      border-bottom-color: #0e639c !important; 
      background: #252526 !important; 
    }
    
    .nhat-api-kv-check {
      width: 16px !important;
      height: 16px !important;
      accent-color: #0e639c !important;
    }
    
    /* Resize handle */
    #nhat-api-tester-panel::after {
      content: '' !important;
      position: absolute !important;
      bottom: 0 !important;
      right: 0 !important;
      width: 15px !important;
      height: 15px !important;
      cursor: nwse-resize !important;
      background: linear-gradient(135deg, transparent 50%, #555 50%) !important;
    }
    
    /* Minimized state */
    #nhat-api-tester-panel.minimized .nhat-api-body {
      display: none;
    }
    
    #nhat-api-tester-panel.minimized {
      height: auto !important;
      min-height: 0;
    }
  `;
  
  document.head.appendChild(style);
}

function setupApiTesterEvents() {
  const panel = document.getElementById('nhat-api-tester-panel');
  if (!panel) return;
  
  // Make draggable
  makeDraggable(panel, panel.querySelector('.nhat-api-header'));
  
  // Close button - chỉ ẩn panel, không xóa (để có thể mở lại bằng indicator)
  panel.querySelector('#nhat-api-close').addEventListener('click', () => {
    toggleApiTesterPanel(); // Ẩn panel
  });
  
  // Minimize button
  panel.querySelector('#nhat-api-minimize').addEventListener('click', () => {
    panel.classList.toggle('minimized');
    const btn = panel.querySelector('#nhat-api-minimize');
    btn.textContent = panel.classList.contains('minimized') ? '🔲' : '➖';
  });

  // Maximize/Restore button
  const maximizeBtn = panel.querySelector('#nhat-api-maximize');
  let prevPanelRect = null;
  maximizeBtn.addEventListener('click', () => {
    if (!panel.classList.contains('maximized')) {
      // Save current size/position
      prevPanelRect = {
        top: panel.style.top,
        left: panel.style.left,
        right: panel.style.right,
        bottom: panel.style.bottom,
        width: panel.style.width,
        height: panel.style.height,
        maxWidth: panel.style.maxWidth,
        maxHeight: panel.style.maxHeight
      };
      panel.classList.add('maximized');
      maximizeBtn.textContent = '🗗';
    } else {
      // Restore previous size/position
      panel.classList.remove('maximized');
      maximizeBtn.textContent = '🗖';
      if (prevPanelRect) {
        panel.style.top = prevPanelRect.top;
        panel.style.left = prevPanelRect.left;
        panel.style.right = prevPanelRect.right;
        panel.style.bottom = prevPanelRect.bottom;
        panel.style.width = prevPanelRect.width;
        panel.style.height = prevPanelRect.height;
        panel.style.maxWidth = prevPanelRect.maxWidth;
        panel.style.maxHeight = prevPanelRect.maxHeight;
      }
    }
  });
  
  // Clear button
  panel.querySelector('#nhat-api-clear').addEventListener('click', () => {
    panel.querySelector('#nhat-api-url').value = '';
    panel.querySelector('#nhat-api-body-editor').value = '';
    panel.querySelector('#nhat-api-response-body').innerHTML = '<div class="nhat-api-empty-state">Click Send để gửi request</div>';
    panel.querySelector('#nhat-api-status').textContent = '';
    panel.querySelector('#nhat-api-status').className = 'nhat-api-status';
  });
  
  // Tab switching (request)
  panel.querySelectorAll('.nhat-api-tabs .nhat-api-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (!tabName) return;
      
      // Update active tab
      tab.parentElement.querySelectorAll('.nhat-api-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show/hide content
      panel.querySelectorAll('.nhat-api-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      const tabContent = panel.querySelector(`#nhat-api-${tabName}-tab`);
      if (tabContent) tabContent.style.display = 'block';
    });
  });
  
  // Tab switching (response)
  panel.querySelectorAll('.nhat-api-response-tabs .nhat-api-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.responseTab;
      if (!tabName) return;
      
      tab.parentElement.querySelectorAll('.nhat-api-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      panel.querySelector('#nhat-api-response-body').style.display = tabName === 'body' ? 'block' : 'none';
      panel.querySelector('#nhat-api-response-headers').style.display = tabName === 'headers' ? 'block' : 'none';
    });
  });
  
  // Add header row
  panel.querySelector('#nhat-api-add-header').addEventListener('click', () => {
    addApiTesterHeaderRow();
  });
  
  // Delete header rows
  panel.querySelectorAll('.nhat-api-kv-delete').forEach(btn => {
    btn.addEventListener('click', (e) => deleteApiTesterRow(e.target));
  });
  
  // Auth type change
  panel.querySelector('#nhat-api-auth-type').addEventListener('change', (e) => {
    updateApiTesterAuthFields(e.target.value);
  });
  
  // Send request
  panel.querySelector('#nhat-api-send').addEventListener('click', () => {
    sendApiTesterRequest();
  });
  
  // Enter key on URL
  panel.querySelector('#nhat-api-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendApiTesterRequest();
    }
  });
  
  // Import cURL button
  panel.querySelector('#nhat-api-import-curl').addEventListener('click', () => {
    panel.querySelector('#nhat-api-curl-modal').style.display = 'flex';
    panel.querySelector('#nhat-api-curl-input').focus();
  });
  
  // Cancel import
  panel.querySelector('#nhat-api-curl-cancel').addEventListener('click', () => {
    panel.querySelector('#nhat-api-curl-modal').style.display = 'none';
  });
  panel.querySelector('#nhat-api-curl-cancel2').addEventListener('click', () => {
    panel.querySelector('#nhat-api-curl-modal').style.display = 'none';
  });
  
  // Confirm import
  panel.querySelector('#nhat-api-curl-import').addEventListener('click', () => {
    const curlCmd = panel.querySelector('#nhat-api-curl-input').value.trim();
    if (curlCmd) {
      parseApiTesterCurl(curlCmd);
      panel.querySelector('#nhat-api-curl-modal').style.display = 'none';
      panel.querySelector('#nhat-api-curl-input').value = '';
    }
  });
  
  // Response tabs (body/headers/cookies)
  panel.querySelectorAll('.nhat-api-resp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.responseTab;
      if (!tabName) return;
      
      panel.querySelectorAll('.nhat-api-resp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      panel.querySelector('#nhat-api-response-body').style.display = tabName === 'body' ? 'block' : 'none';
      panel.querySelector('#nhat-api-response-headers').style.display = tabName === 'headers' ? 'block' : 'none';
      panel.querySelector('#nhat-api-response-cookies').style.display = tabName === 'cookies' ? 'block' : 'none';
      panel.querySelector('#nhat-api-view-modes').style.display = tabName === 'body' ? 'flex' : 'none';
    });
  });
  
  // View mode buttons (Pretty/Raw/Preview)
  panel.querySelectorAll('.nhat-api-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.nhat-api-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const mode = btn.dataset.view;
      updateApiTesterResponseView(mode);
    });
  });
  
  // Load Records button
  panel.querySelector('#nhat-api-load-records').addEventListener('click', () => {
    showApiTesterRecordsModal();
  });
  
  // Records modal close
  panel.querySelector('#nhat-api-records-close').addEventListener('click', () => {
    panel.querySelector('#nhat-api-records-modal').style.display = 'none';
  });
  
  // History button
  panel.querySelector('#nhat-api-history').addEventListener('click', () => {
    showApiTesterHistoryModal();
  });
  
  // History modal close
  panel.querySelector('#nhat-api-history-close').addEventListener('click', () => {
    panel.querySelector('#nhat-api-history-modal').style.display = 'none';
  });
  
  // History clear
  panel.querySelector('#nhat-api-history-clear').addEventListener('click', () => {
    apiTesterHistory = [];
    panel.querySelector('#nhat-api-history-list').innerHTML = '<div class="nhat-api-empty-state">Chưa có lịch sử</div>';
  });
  
  // Import List button
  panel.querySelector('#nhat-api-import-list').addEventListener('click', () => {
    panel.querySelector('#nhat-api-list-modal').style.display = 'flex';
  });
  
  // Import List modal close
  panel.querySelector('#nhat-api-list-close').addEventListener('click', () => {
    panel.querySelector('#nhat-api-list-modal').style.display = 'none';
  });
  
  // Import List file select
  panel.querySelector('#nhat-api-list-select').addEventListener('click', () => {
    panel.querySelector('#nhat-api-list-file').click();
  });
  
  // Handle file selection
  panel.querySelector('#nhat-api-list-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          displayApiTesterImportedList(data);
        } catch (err) {
          alert('Không thể parse file JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  });
}

function addApiTesterHeaderRow(key = '', value = '') {
  const editor = document.querySelector('#nhat-api-headers-editor');
  if (!editor) return;
  
  const row = document.createElement('div');
  row.className = 'nhat-api-kv-row';
  row.innerHTML = `
    <input type="text" class="nhat-api-kv-key" placeholder="Header name" value="${escapeApiTesterHtml(key)}">
    <input type="text" class="nhat-api-kv-value" placeholder="Value" value="${escapeApiTesterHtml(value)}">
    <button class="nhat-api-kv-delete">✕</button>
  `;
  
  row.querySelector('.nhat-api-kv-delete').addEventListener('click', (e) => {
    deleteApiTesterRow(e.target);
  });
  
  editor.appendChild(row);
}

function deleteApiTesterRow(btn) {
  const row = btn.closest('.nhat-api-kv-row');
  const editor = row.parentElement;
  if (editor.querySelectorAll('.nhat-api-kv-row').length > 1) {
    row.remove();
  } else {
    row.querySelector('.nhat-api-kv-key').value = '';
    row.querySelector('.nhat-api-kv-value').value = '';
  }
}

function updateApiTesterAuthFields(type) {
  const container = document.querySelector('#nhat-api-auth-fields');
  if (!container) return;
  
  switch (type) {
    case 'bearer':
      container.innerHTML = '<input type="text" id="nhat-api-bearer-token" placeholder="Enter Bearer Token">';
      break;
    case 'basic':
      container.innerHTML = `
        <input type="text" id="nhat-api-basic-user" placeholder="Username">
        <input type="password" id="nhat-api-basic-pass" placeholder="Password">
      `;
      break;
    case 'apikey':
      container.innerHTML = `
        <input type="text" id="nhat-api-key-name" placeholder="API Key Name (e.g., X-API-Key)">
        <input type="text" id="nhat-api-key-value" placeholder="API Key Value">
      `;
      break;
    default:
      container.innerHTML = '';
  }
}

function escapeApiTesterHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// History storage
let apiTesterHistory = [];
let apiTesterLastResponse = { body: '', headers: {}, cookies: '' };
let apiTesterCurrentView = 'pretty';

// Show Records modal and load from storage
function showApiTesterRecordsModal() {
  const panel = document.getElementById('nhat-api-tester-panel');
  const modal = panel.querySelector('#nhat-api-records-modal');
  const listContainer = panel.querySelector('#nhat-api-records-list');
  
  modal.style.display = 'flex';
  listContainer.innerHTML = '<div class="nhat-api-empty-state">Đang tải...</div>';
  
  // Load records from extension storage
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['recordedRequests'], (result) => {
      const requests = result.recordedRequests || [];
      if (requests.length === 0) {
        listContainer.innerHTML = '<div class="nhat-api-empty-state">📭 Chưa có request nào được record.<br>Bật Record Requests trong popup để ghi lại.</div>';
        return;
      }
      
      listContainer.innerHTML = '';
      requests.forEach((req, index) => {
        const item = document.createElement('div');
        item.className = 'nhat-api-record-item';
        item.innerHTML = `
          <div>
            <span class="nhat-api-record-method nhat-api-method-${req.method}">${req.method}</span>
            <span class="nhat-api-record-url">${escapeApiTesterHtml(req.url)}</span>
          </div>
          <div class="nhat-api-record-meta">${new Date(req.timestamp).toLocaleString()}</div>
        `;
        item.addEventListener('click', () => {
          loadApiTesterRequest(req);
          modal.style.display = 'none';
        });
        listContainer.appendChild(item);
      });
    });
  } else {
    listContainer.innerHTML = '<div class="nhat-api-empty-state">⚠️ Không thể truy cập storage</div>';
  }
}

// Show History modal
function showApiTesterHistoryModal() {
  const panel = document.getElementById('nhat-api-tester-panel');
  const modal = panel.querySelector('#nhat-api-history-modal');
  const listContainer = panel.querySelector('#nhat-api-history-list');

  modal.style.display = 'flex';

  if (apiTesterHistory.length === 0) {
    listContainer.innerHTML = '<div class="nhat-api-empty-state">📭 Chưa có lịch sử.<br>Gửi request để bắt đầu.</div>';
    return;
  }

  listContainer.innerHTML = '';

  apiTesterHistory.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'nhat-api-history-item';

    div.innerHTML = `
      <div>
        <span class="nhat-api-record-method nhat-api-method-${item.method}">${item.method}</span>
        <span class="nhat-api-record-url">${escapeApiTesterHtml(item.url)}</span>
      </div>
      <div class="nhat-api-record-meta">
        <span>${item.status ? `Status: ${item.status}` : ''}</span>
        <span>${item.time ? `${item.time}ms` : ''}</span>
        <span>${new Date(item.timestamp).toLocaleTimeString()}</span>
      </div>
    `;

    // Click to load
    div.addEventListener('click', () => {
      loadApiTesterRequest(item);
      modal.style.display = 'none';
    });

    listContainer.appendChild(div);
  });
}

// Display imported list from JSON file
function displayApiTesterImportedList(data) {
  const panel = document.getElementById('nhat-api-tester-panel');
  const listContainer = panel.querySelector('#nhat-api-list-items');
  
  let requests = [];
  if (Array.isArray(data)) {
    requests = data;
  } else if (data.requests && Array.isArray(data.requests)) {
    requests = data.requests;
  }
  
  if (requests.length === 0) {
    listContainer.innerHTML = '<div class="nhat-api-empty-state">Không tìm thấy request trong file</div>';
    return;
  }
  
  listContainer.innerHTML = '';
  requests.forEach((req) => {
    const item = document.createElement('div');
    item.className = 'nhat-api-record-item';
    item.innerHTML = `
      <div>
        <span class="nhat-api-record-method nhat-api-method-${req.method || 'GET'}">${req.method || 'GET'}</span>
        <span class="nhat-api-record-url">${escapeApiTesterHtml(req.url)}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      loadApiTesterRequest(req);
      panel.querySelector('#nhat-api-list-modal').style.display = 'none';
    });
    listContainer.appendChild(item);
  });
}

// Load a request into the form
function loadApiTesterRequest(req) {
  const panel = document.getElementById('nhat-api-tester-panel');
  if (!panel) return;
  
  // Set method
  panel.querySelector('#nhat-api-method').value = req.method || 'GET';
  
  // Set URL
  panel.querySelector('#nhat-api-url').value = req.url || '';
  
  // Set headers
  const headersEditor = panel.querySelector('#nhat-api-headers-editor');
  headersEditor.innerHTML = '';
  
  if (req.headers && typeof req.headers === 'object') {
    const headers = req.headers;
    let headerEntries = [];
    
    if (Array.isArray(headers)) {
      headerEntries = headers;
    } else {
      headerEntries = Object.entries(headers).map(([key, value]) => ({ key, value }));
    }
    
    if (headerEntries.length === 0) {
      addApiTesterHeaderRow();
    } else {
      headerEntries.forEach(h => {
        addApiTesterHeaderRow(h.key || h.name, h.value);
      });
    }
  } else {
    addApiTesterHeaderRow();
  }
  
  // Set body
  if (req.body) {
    panel.querySelector('#nhat-api-body-editor').value = typeof req.body === 'object' ? JSON.stringify(req.body, null, 2) : req.body;
    
    // Auto-select body type
    if (typeof req.body === 'object' || (typeof req.body === 'string' && req.body.trim().startsWith('{'))) {
      panel.querySelector('input[name="nhat-body-type"][value="json"]').checked = true;
    } else {
      panel.querySelector('input[name="nhat-body-type"][value="raw"]').checked = true;
    }
  }
  
  // Show headers tab
  panel.querySelector('.nhat-api-tabs .nhat-api-tab[data-tab="headers"]').click();
}

// Update response view mode (Pretty/Raw/Preview)
function updateApiTesterResponseView(mode) {
  apiTesterCurrentView = mode;
  const panel = document.getElementById('nhat-api-tester-panel');
  const responseBody = panel.querySelector('#nhat-api-response-body');

  if (!apiTesterLastResponse.body) return;

  switch (mode) {
    case 'pretty':
      try {
        const json = JSON.parse(apiTesterLastResponse.body);
        responseBody.innerHTML = `<pre style="margin:0;white-space:pre-wrap;">${syntaxHighlightApiTesterJson(JSON.stringify(json, null, 2))}</pre>`;
      } catch {
        responseBody.innerHTML = `<pre style="margin:0;white-space:pre-wrap;">${escapeApiTesterHtml(apiTesterLastResponse.body)}</pre>`;
      }
      break;
    case 'raw':
      responseBody.innerHTML = `<pre style="margin:0;white-space:pre-wrap;">${escapeApiTesterHtml(apiTesterLastResponse.body)}</pre>`;
      break;
    case 'preview':
      // For HTML content, render it in an iframe - DO NOT escape HTML for srcdoc
      responseBody.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;height:400px;border:1px solid #444;background:white;border-radius:4px;';
      iframe.sandbox = 'allow-scripts allow-same-origin';
      iframe.referrerpolicy = 'no-referrer';

      // Use srcdoc for HTML preview
      try {
        iframe.srcdoc = apiTesterLastResponse.body;
      } catch (e) {
        console.error('[API Tester] Preview error:', e);
        responseBody.innerHTML = `<pre style="margin:0;white-space:pre-wrap;color:#f14c4c;">Preview error: ${e.message}</pre>`;
        return;
      }

      responseBody.appendChild(iframe);
      break;
  }
}

function syntaxHighlightApiTesterJson(json) {
  json = escapeApiTesterHtml(json);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
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

async function sendApiTesterRequest() {
  const panel = document.getElementById('nhat-api-tester-panel');
  if (!panel) return;
  
  const method = panel.querySelector('#nhat-api-method').value;
  let url = panel.querySelector('#nhat-api-url').value.trim();
  
  if (!url) {
    alert('Vui lòng nhập URL');
    return;
  }
  
  // Xử lý URL tương đối (bắt đầu bằng /)
  if (url.startsWith('/')) {
    url = window.location.origin + url;
  } else if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }
  
  // Get headers
  const headers = {};
  panel.querySelectorAll('#nhat-api-headers-editor .nhat-api-kv-row').forEach(row => {
    const key = row.querySelector('.nhat-api-kv-key').value.trim();
    const value = row.querySelector('.nhat-api-kv-value').value.trim();
    if (key) headers[key] = value;
  });
  
  // Get auth headers
  const authType = panel.querySelector('#nhat-api-auth-type').value;
  if (authType === 'bearer') {
    const token = panel.querySelector('#nhat-api-bearer-token')?.value;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } else if (authType === 'basic') {
    const user = panel.querySelector('#nhat-api-basic-user')?.value || '';
    const pass = panel.querySelector('#nhat-api-basic-pass')?.value || '';
    if (user || pass) {
      headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
    }
  } else if (authType === 'apikey') {
    const keyName = panel.querySelector('#nhat-api-key-name')?.value;
    const keyValue = panel.querySelector('#nhat-api-key-value')?.value;
    if (keyName && keyValue) headers[keyName] = keyValue;
  }
  
  // Get body
  let body = null;
  const bodyType = panel.querySelector('input[name="nhat-body-type"]:checked')?.value || 'none';
  if (method !== 'GET' && method !== 'HEAD' && bodyType !== 'none') {
    body = panel.querySelector('#nhat-api-body-editor').value;
    if (bodyType === 'json' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    } else if (bodyType === 'form' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  
  // Show loading
  const responseBody = panel.querySelector('#nhat-api-response-body');
  const responseHeaders = panel.querySelector('#nhat-api-response-headers');
  const statusEl = panel.querySelector('#nhat-api-status');
  
  responseBody.innerHTML = '<div class="nhat-api-loading">⏳ Đang gửi request...</div>';
  statusEl.textContent = '';
  statusEl.className = 'nhat-api-status';
  
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include' // Gửi cookies của trang gốc
    });
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    // Get response body
    const contentType = response.headers.get('content-type') || '';
    let responseText = await response.text();
    let formattedResponse = responseText;
    
    // Store raw response for view mode switching
    apiTesterLastResponse.body = responseText;

    // Collect headers for later use
    const responseHeadersObj = {};
    response.headers.forEach((value, key) => {
      responseHeadersObj[key] = value;
    });
    apiTesterLastResponse.headers = responseHeadersObj;

    // Format JSON if applicable
    if (contentType.includes('application/json') || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
      try {
        const json = JSON.parse(responseText);
        formattedResponse = syntaxHighlightApiTesterJson(JSON.stringify(json, null, 2));
      } catch (e) {
        formattedResponse = escapeApiTesterHtml(responseText);
      }
    } else {
      formattedResponse = escapeApiTesterHtml(responseText);
    }

    // Display response (default to pretty mode)
    responseBody.innerHTML = formattedResponse || '<div class="nhat-api-empty-state">Empty response</div>';

    // Reset view mode to pretty
    panel.querySelectorAll('.nhat-api-view-btn').forEach(btn => btn.classList.remove('active'));
    panel.querySelector('.nhat-api-view-btn[data-view="pretty"]').classList.add('active');
    apiTesterCurrentView = 'pretty';

    // Display headers
    let headersHtml = '';
    response.headers.forEach((value, key) => {
      headersHtml += `<span class="json-key">${escapeApiTesterHtml(key)}</span>: <span class="json-string">${escapeApiTesterHtml(value)}</span>\n`;
    });
    responseHeaders.innerHTML = headersHtml || 'No headers';

    // Status
    const size = new Blob([responseText]).size;
    const sizeStr = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B';
    statusEl.textContent = `${response.status} ${response.statusText} | ${duration}ms | ${sizeStr}`;

    if (response.status >= 200 && response.status < 300) {
      statusEl.classList.add('success');
    } else if (response.status >= 300 && response.status < 400) {
      statusEl.classList.add('redirect');
    } else {
      statusEl.classList.add('error');
    }

    // Add to history
    apiTesterHistory.unshift({
      method,
      url,
      status: response.status,
      time: duration,
      timestamp: Date.now(),
      headers,
      body
    });

    // Keep only last 50 items
    if (apiTesterHistory.length > 50) {
      apiTesterHistory = apiTesterHistory.slice(0, 50);
    }
    
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    responseBody.innerHTML = `<div style="color: #f48771;">❌ Error: ${escapeApiTesterHtml(error.message)}</div>`;
    statusEl.textContent = `Error | ${duration}ms`;
    statusEl.classList.add('error');
  }
}

function parseApiTesterCurl(curlCmd) {
  const panel = document.getElementById('nhat-api-tester-panel');
  if (!panel) return;
  
  try {
    // Normalize curl command
    let cmd = curlCmd.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract URL
    const urlMatch = cmd.match(/curl\s+(?:.*?\s+)?['"]?(https?:\/\/[^\s'"]+|\/[^\s'"]+)['"]?/i) ||
                     cmd.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/);
    if (urlMatch) {
      panel.querySelector('#nhat-api-url').value = urlMatch[1];
    }
    
    // Extract method
    const methodMatch = cmd.match(/-X\s+(\w+)/i);
    if (methodMatch) {
      panel.querySelector('#nhat-api-method').value = methodMatch[1].toUpperCase();
    } else if (cmd.includes('-d ') || cmd.includes('--data')) {
      panel.querySelector('#nhat-api-method').value = 'POST';
    }
    
    // Extract headers
    const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
    let headerMatch;
    
    // Clear existing headers
    const headersEditor = panel.querySelector('#nhat-api-headers-editor');
    headersEditor.innerHTML = '';
    
    let headerCount = 0;
    while ((headerMatch = headerRegex.exec(cmd)) !== null) {
      const [key, ...valueParts] = headerMatch[1].split(':');
      const value = valueParts.join(':').trim();
      if (key && value) {
        addApiTesterHeaderRow(key.trim(), value);
        headerCount++;
      }
    }
    
    // Add empty row if no headers
    if (headerCount === 0) {
      addApiTesterHeaderRow();
    }
    
    // Extract body
    const dataMatch = cmd.match(/(?:-d|--data(?:-raw)?)\s+['"](.+?)['"]/s) ||
                      cmd.match(/(?:-d|--data(?:-raw)?)\s+(\S+)/);
    if (dataMatch) {
      const body = dataMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
      panel.querySelector('#nhat-api-body-editor').value = body;
      
      // Switch to body tab
      panel.querySelector('.nhat-api-tabs .nhat-api-tab[data-tab="body"]').click();
      
      // Check if JSON
      try {
        JSON.parse(body);
        panel.querySelector('input[name="nhat-body-type"][value="json"]').checked = true;
      } catch (e) {
        panel.querySelector('input[name="nhat-body-type"][value="raw"]').checked = true;
      }
    }
    
    console.log('[API Tester] cURL imported successfully');
    
  } catch (error) {
    console.error('[API Tester] Failed to parse cURL:', error);
    alert('Không thể parse cURL command. Vui lòng kiểm tra lại format.');
  }
}

function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.addEventListener('mousedown', dragMouseDown);
  
  function dragMouseDown(e) {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }
  
  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    let newTop = element.offsetTop - pos2;
    let newLeft = element.offsetLeft - pos1;
    
    // Keep within viewport
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - 50));
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 100));
    
    element.style.top = newTop + 'px';
    element.style.left = newLeft + 'px';
    element.style.right = 'auto';
  }
  
  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
  }
}

// ==================== COPY MODE FUNCTIONS ====================

// Thêm CSS highlight style vào tất cả frames
function addCopyModeHighlightStyle() {
  if (document.getElementById('nhat-copy-mode-style')) return;
  
  const style = document.createElement('style');
  style.id = 'nhat-copy-mode-style';
  style.textContent = `
    .nhat-copy-highlight {
      outline: 2px dashed #9c27b0 !important;
      outline-offset: 2px !important;
      background-color: rgba(156, 39, 176, 0.1) !important;
      cursor: copy !important;
      transition: all 0.15s ease !important;
    }
  `;
  
  // Append vào head hoặc documentElement (cho frameset)
  const container = document.head || document.documentElement;
  if (container) {
    container.appendChild(style);
    console.log('[Keep Alive] Copy Mode highlight style added, isTopFrame:', isTopFrame);
  }
}

// Tạo tooltip hiển thị "Đã copy!"
function showCopyTooltip(x, y, text) {
  // Xóa tooltip cũ nếu có
  const existingTooltip = document.getElementById('nhat-copy-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  const copiedText = messages.copiedText || 'Đã copy!';
  
  const tooltip = document.createElement('div');
  tooltip.id = 'nhat-copy-tooltip';
  tooltip.innerHTML = `
    <div style="display: flex; align-items: center; gap: 5px;">
      <span style="font-size: 14px;">✅</span>
      <span>${copiedText}</span>
    </div>
    <div style="font-size: 10px; opacity: 0.8; margin-top: 3px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
      "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"
    </div>
  `;
  tooltip.style.cssText = `
    position: fixed;
    top: ${y - 60}px;
    left: ${x}px;
    transform: translateX(-50%);
    background: rgba(76, 175, 80, 0.95);
    color: white;
    padding: 8px 14px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 999999999;
    font-family: Arial, sans-serif;
    font-size: 12px;
    animation: copyTooltipIn 0.3s ease-out;
    pointer-events: none;
  `;
  
  // Thêm CSS animation nếu chưa có
  if (!document.getElementById('nhat-copy-tooltip-style')) {
    const style = document.createElement('style');
    style.id = 'nhat-copy-tooltip-style';
    style.textContent = `
      @keyframes copyTooltipIn {
        0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes copyTooltipOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;
    // Append vào head hoặc documentElement
    (document.head || document.documentElement).appendChild(style);
  }
  
  // Append vào body hoặc documentElement (cho frameset)
  const container = document.body || document.documentElement;
  container.appendChild(tooltip);
  
  // Tự động xóa sau 1.5 giây
  setTimeout(() => {
    if (tooltip.parentElement) {
      tooltip.style.animation = 'copyTooltipOut 0.3s ease-out forwards';
      setTimeout(() => tooltip.remove(), 300);
    }
  }, 1500);
}

// Hiển thị menu chọn copy Value hay Text cho element SELECT
function showSelectCopyMenu(x, y, selectElement) {
  // Xóa menu cũ nếu có
  const existingMenu = document.getElementById('nhat-select-copy-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // Lấy option đang được chọn
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  if (!selectedOption) return;
  
  const value = selectedOption.value || '';
  const text = selectedOption.textContent?.trim() || selectedOption.innerText?.trim() || '';
  
  const menu = document.createElement('div');
  menu.id = 'nhat-select-copy-menu';
  menu.innerHTML = `
    <div style="font-size: 11px; opacity: 0.8; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
      📋 Chọn kiểu copy:
    </div>
    <div class="nhat-copy-option" data-type="value" style="padding: 8px 10px; cursor: pointer; border-radius: 4px; margin-bottom: 4px; background: rgba(255,255,255,0.1);">
      <div style="font-weight: bold; font-size: 12px;">📝 Value</div>
      <div style="font-size: 10px; opacity: 0.8; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${value}"</div>
    </div>
    <div class="nhat-copy-option" data-type="text" style="padding: 8px 10px; cursor: pointer; border-radius: 4px; background: rgba(255,255,255,0.1);">
      <div style="font-weight: bold; font-size: 12px;">📄 Text</div>
      <div style="font-size: 10px; opacity: 0.8; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${text}"</div>
    </div>
  `;
  menu.style.cssText = `
    position: fixed;
    top: ${y + 10}px;
    left: ${x}px;
    transform: translateX(-50%);
    background: rgba(33, 150, 243, 0.95);
    color: white;
    padding: 10px 12px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 999999999;
    font-family: Arial, sans-serif;
    font-size: 12px;
    animation: copyTooltipIn 0.2s ease-out;
    min-width: 200px;
  `;
  
  // Append vào body hoặc documentElement
  const container = document.body || document.documentElement;
  container.appendChild(menu);
  
  // Xử lý hover effect
  menu.querySelectorAll('.nhat-copy-option').forEach(option => {
    option.addEventListener('mouseenter', () => {
      option.style.background = 'rgba(255,255,255,0.25)';
    });
    option.addEventListener('mouseleave', () => {
      option.style.background = 'rgba(255,255,255,0.1)';
    });
    
    // Xử lý click để copy
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = option.dataset.type;
      const copyText = type === 'value' ? value : text;
      
      navigator.clipboard.writeText(copyText).then(() => {
        console.log('[Keep Alive] Copied from SELECT:', type, '=', copyText);
        menu.remove();
        showCopyTooltip(x, y, copyText);
      }).catch(err => {
        console.error('[Keep Alive] Failed to copy:', err);
        // Fallback
        try {
          const textArea = document.createElement('textarea');
          textArea.value = copyText;
          textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          menu.remove();
          showCopyTooltip(x, y, copyText);
        } catch (e2) {
          console.error('[Keep Alive] Fallback copy failed:', e2);
        }
      });
    });
  });
  
  // Click bên ngoài menu để đóng
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu, true);
    }
  };
  // Delay một chút để tránh click hiện tại đóng menu ngay
  setTimeout(() => {
    document.addEventListener('click', closeMenu, true);
  }, 100);
  
  // Tự động đóng sau 10 giây nếu không chọn
  setTimeout(() => {
    if (menu.parentElement) {
      menu.remove();
      document.removeEventListener('click', closeMenu, true);
    }
  }, 10000);
}

// Tạo floating indicator cho Copy Mode (CHỈ Ở TOP FRAME)
// Indicator luôn hiện, chỉ đổi trạng thái BẬT/TẮT, có thể kéo thả
function createCopyModeIndicator() {
  // Chỉ hiện indicator ở top frame để tránh trùng lặp
  if (!isTopFrame) {
    return;
  }
  
  let indicator = document.getElementById('nhat-copy-mode-indicator');
  
  // Nếu đã có indicator, chỉ cập nhật trạng thái
  if (indicator) {
    updateCopyModeIndicatorState(indicator);
    return;
  }
  
  indicator = document.createElement('div');
  indicator.id = 'nhat-copy-mode-indicator';
  updateCopyModeIndicatorState(indicator);
  
  // Set màu mặc định dựa trên trạng thái copyModeEnabled
  const defaultBg = copyModeEnabled 
    ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.95), rgba(56, 142, 60, 0.95))'
    : 'linear-gradient(135deg, #757575, #616161)';
  
  indicator.style.cssText = `
    position: fixed !important;
    bottom: 80px !important;
    right: 20px !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 20px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
    z-index: 2147483647 !important;
    font-family: Arial, sans-serif !important;
    cursor: pointer !important;
    user-select: none !important;
    display: ${showCopyIndicator ? 'block' : 'none'} !important;
    visibility: ${showCopyIndicator ? 'visible' : 'hidden'} !important;
    opacity: 1 !important;
    transition: background 0.3s ease !important;
    background: ${defaultBg} !important;
  `;
  
  // Drag and drop functionality
  let isDragging = false;
  let hasMoved = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  // Load vị trí đã lưu từ localStorage (với giới hạn hợp lý)
  try {
    const savedPosition = localStorage.getItem('nhat-copy-indicator-position');
    if (savedPosition) {
      const pos = JSON.parse(savedPosition);
      // Giới hạn vị trí trong màn hình (không cho kéo quá xa)
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      const minX = -window.innerWidth + 100;
      const minY = -window.innerHeight + 100;
      
      xOffset = Math.max(minX, Math.min(maxX, pos.x || 0));
      yOffset = Math.max(minY, Math.min(maxY, pos.y || 0));
      
      // Nếu vị trí lưu nằm ngoài màn hình, reset về 0
      if (Math.abs(pos.x) > maxX || Math.abs(pos.y) > maxY) {
        console.log('[Keep Alive] Reset copy indicator position - was out of bounds');
        xOffset = 0;
        yOffset = 0;
        localStorage.removeItem('nhat-copy-indicator-position');
      } else {
        indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    }
  } catch (e) {
    console.log('[Keep Alive] Could not load saved copy indicator position');
  }
  
  indicator.addEventListener('mousedown', (e) => {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    hasMoved = false;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      // Check if moved more than 5px
      if (Math.abs(currentX - xOffset) > 5 || Math.abs(currentY - yOffset) > 5) {
        hasMoved = true;
      }
      
      xOffset = currentX;
      yOffset = currentY;
      indicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      
      // Lưu vị trí vào localStorage
      try {
        localStorage.setItem('nhat-copy-indicator-position', JSON.stringify({
          x: xOffset,
          y: yOffset
        }));
      } catch (e) {
        console.log('[Keep Alive] Could not save copy indicator position');
      }
    }
  });
  
  // Click để bật/tắt Copy Mode (chỉ khi không kéo)
  indicator.addEventListener('click', (e) => {
    // Chỉ toggle nếu không kéo
    if (hasMoved) {
      hasMoved = false;
      return;
    }
    
    const newState = !copyModeEnabled;
    copyModeEnabled = newState;
    chrome.storage.local.set({ copyModeEnabled: newState });
    
    if (newState) {
      enableCopyMode();
    } else {
      disableCopyMode();
    }
  });
  
  // Append vào body hoặc documentElement (cho frameset)
  const container = document.body || document.documentElement;
  container.appendChild(indicator);
  
  console.log('[Keep Alive] Copy Mode indicator created');
}

// Cập nhật trạng thái indicator (BẬT/TẮT)
function updateCopyModeIndicatorState(indicator) {
  if (!indicator) {
    indicator = document.getElementById('nhat-copy-mode-indicator');
  }
  if (!indicator) return;
  
  const copyModeOnText = messages.copyModeOn || '📋 Copy: BẬT';
  const copyModeOffText = messages.copyModeOff || '📋 Copy: TẮT';
  
  if (copyModeEnabled) {
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">📋</span>
        <span style="font-size: 11px; font-weight: bold;">Copy: BẬT</span>
      </div>
    `;
    indicator.style.background = 'linear-gradient(135deg, rgba(76, 175, 80, 0.95), rgba(56, 142, 60, 0.95))';
  } else {
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">📋</span>
        <span style="font-size: 11px; font-weight: bold;">Copy: TẮT</span>
      </div>
    `;
    // Màu xám đậm, không trong suốt
    indicator.style.background = 'linear-gradient(135deg, #757575, #616161)';
  }
}

// Khởi tạo Copy Mode indicator khi DOM ready (LUÔN tạo nếu showCopyIndicator = true)
function initCopyModeIndicator() {
  if (!isTopFrame) return;
  
  console.log('[Keep Alive] initCopyModeIndicator called, showCopyIndicator:', showCopyIndicator);
  
  const isDOMReady = () => {
    return document.body || document.documentElement || document.readyState !== 'loading';
  };
  
  const doCreate = () => {
    console.log('[Keep Alive] Creating Copy Mode indicator...');
    createCopyModeIndicator();
  };
  
  if (isDOMReady()) {
    doCreate();
  } else {
    document.addEventListener('DOMContentLoaded', doCreate, { once: true });
  }
}

// Lấy text content từ element
function getTextFromElement(element) {
  if (!element) return '';
  
  // Nếu là SELECT element, ưu tiên lấy text của selected option
  if (element.tagName === 'SELECT') {
    const selectedOption = element.options[element.selectedIndex];
    if (selectedOption) {
      const optionText = selectedOption.textContent?.trim() || selectedOption.innerText?.trim();
      if (optionText) {
        return optionText;
      }
      // Fallback về value nếu không có text
      if (selectedOption.value) {
        return selectedOption.value.trim();
      }
    }
  }
  
  // Ưu tiên các thuộc tính có text (cho các element khác như INPUT)
  // Nhưng không ưu tiên value cho SELECT (đã xử lý ở trên)
  if (element.tagName !== 'SELECT' && element.value && typeof element.value === 'string') {
    return element.value.trim();
  }
  
  if (element.textContent) {
    return element.textContent.trim();
  }
  
  if (element.innerText) {
    return element.innerText.trim();
  }
  
  if (element.alt) {
    return element.alt.trim();
  }
  
  if (element.title) {
    return element.title.trim();
  }
  
  if (element.placeholder) {
    return element.placeholder.trim();
  }
  
  return '';
}

// Xử lý hover event
function handleCopyModeHover(e) {
  if (!copyModeEnabled || !copyModeActive) {
    console.log('[Keep Alive] Hover blocked - copyModeEnabled:', copyModeEnabled, 'copyModeActive:', copyModeActive);
    return;
  }
  
  const target = e.target;
  
  // Bỏ qua các element của extension
  try {
    if (target.id && target.id.startsWith('nhat-')) return;
    if (target.closest && target.closest('#nhat-copy-mode-indicator')) return;
    if (target.closest && target.closest('#nhat-copy-tooltip')) return;
    if (target.closest && target.closest('#nhat-debug-indicator')) return;
    if (target.closest && target.closest('#nhat-devtools-button')) return;
  } catch (err) {
    // Bỏ qua lỗi closest
  }
  
  // Xóa highlight cũ
  if (lastHoveredElement && lastHoveredElement !== target) {
    try {
      lastHoveredElement.classList.remove('nhat-copy-highlight');
    } catch (err) {}
  }
  
  // Lấy text từ element
  const text = getTextFromElement(target);
  
  // Chỉ highlight nếu có text
  if (text && text.length > 0) {
    try {
      target.classList.add('nhat-copy-highlight');
      lastHoveredElement = target;
      console.log('[Keep Alive] Highlighting:', target.tagName, 'text:', text.substring(0, 30));
    } catch (err) {
      console.log('[Keep Alive] Cannot add highlight class:', err);
    }
  }
}

// Xử lý click event để copy
function handleCopyModeClick(e) {
  if (!copyModeEnabled || !copyModeActive) return;
  
  const target = e.target;
  
  // Bỏ qua các element của extension
  try {
    if (target.id && target.id.startsWith('nhat-')) return;
    if (target.closest && target.closest('#nhat-copy-mode-indicator')) return;
    if (target.closest && target.closest('#nhat-copy-tooltip')) return;
    if (target.closest && target.closest('#nhat-select-copy-menu')) return;
    if (target.closest && target.closest('#nhat-debug-indicator')) return;
    if (target.closest && target.closest('#nhat-devtools-button')) return;
  } catch (err) {
    // Bỏ qua lỗi closest
  }
  
  // Kiểm tra nếu là SELECT element -> hiện menu chọn copy value hoặc text
  if (target.tagName === 'SELECT') {
    e.preventDefault();
    e.stopPropagation();
    showSelectCopyMenu(e.clientX, e.clientY, target);
    return;
  }
  
  // Lấy text từ element
  const text = getTextFromElement(target);
  
  if (text && text.length > 0) {
    // Ngăn hành vi mặc định (click button, link, etc.)
    e.preventDefault();
    e.stopPropagation();
    
    // Copy vào clipboard
    navigator.clipboard.writeText(text).then(() => {
      console.log('[Keep Alive] Copied:', text);
      showCopyTooltip(e.clientX, e.clientY, text);
    }).catch(err => {
      console.error('[Keep Alive] Failed to copy:', err);
      // Fallback: sử dụng execCommand
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyTooltip(e.clientX, e.clientY, text);
      } catch (e2) {
        console.error('[Keep Alive] Fallback copy failed:', e2);
      }
    });
  }
}

// Xử lý mouse leave
function handleCopyModeLeave(e) {
  if (!copyModeEnabled || !copyModeActive) return;
  
  const target = e.target;
  try {
    if (target.classList) {
      target.classList.remove('nhat-copy-highlight');
    }
  } catch (err) {}
}

// Bật Copy Mode
function enableCopyMode() {
  console.log('[Keep Alive] enableCopyMode called, copyModeActive:', copyModeActive);
  
  // Tránh bật nhiều lần
  if (copyModeActive) {
    console.log('[Keep Alive] Copy Mode already active, skipping');
    return;
  }
  
  console.log('[Keep Alive] Copy Mode enabling...');
  
  // Hàm thực sự bật Copy Mode
  const doEnable = () => {
    if (copyModeActive) return; // Double check
    
    copyModeActive = true;
    console.log('[Keep Alive] Copy Mode enabled, copyModeActive set to true');
    
    // Tạo hoặc cập nhật indicator
    createCopyModeIndicator();
    
    // Thêm event listeners
    document.addEventListener('mouseover', handleCopyModeHover, true);
    document.addEventListener('click', handleCopyModeClick, true);
    document.addEventListener('mouseout', handleCopyModeLeave, true);
    
    console.log('[Keep Alive] Event listeners added for Copy Mode');
  };
  
  // Kiểm tra DOM ready - hỗ trợ cả frameset (không có body) và body thường
  const isDOMReady = () => {
    return document.body || document.documentElement || document.readyState !== 'loading';
  };
  
  // Đợi DOM ready
  if (isDOMReady()) {
    doEnable();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doEnable, { once: true });
  } else {
    // Fallback: đợi documentElement
    const waitForDOM = setInterval(() => {
      if (isDOMReady()) {
        clearInterval(waitForDOM);
        doEnable();
      }
    }, 50);
  }
}

// Tắt Copy Mode (không xóa indicator, chỉ cập nhật trạng thái)
function disableCopyMode() {
  // Tránh tắt nhiều lần
  if (!copyModeActive) {
    console.log('[Keep Alive] Copy Mode already inactive, skipping');
    // Vẫn cập nhật indicator state
    updateCopyModeIndicatorState();
    return;
  }
  
  copyModeActive = false;
  console.log('[Keep Alive] Copy Mode disabled');
  
  // Cập nhật trạng thái indicator (không xóa)
  updateCopyModeIndicatorState();
  
  // Xóa highlight nếu có
  if (lastHoveredElement) {
    lastHoveredElement.classList.remove('nhat-copy-highlight');
    lastHoveredElement = null;
  }
  
  // Xóa tất cả highlight còn lại
  document.querySelectorAll('.nhat-copy-highlight').forEach(el => {
    el.classList.remove('nhat-copy-highlight');
  });
  
  // Xóa event listeners
  document.removeEventListener('mouseover', handleCopyModeHover, true);
  document.removeEventListener('click', handleCopyModeClick, true);
  document.removeEventListener('mouseout', handleCopyModeLeave, true);
}

// ==================== TRANSLATE MODE FUNCTIONS ====================

// Thêm CSS highlight style cho Translate Mode
function addTranslateModeHighlightStyle() {
  if (document.getElementById('nhat-translate-mode-style')) return;
  
  const style = document.createElement('style');
  style.id = 'nhat-translate-mode-style';
  style.textContent = `
    .nhat-translate-highlight {
      outline: 2px dashed #2196F3 !important;
      outline-offset: 2px !important;
      background-color: rgba(33, 150, 243, 0.1) !important;
      cursor: help !important;
      transition: all 0.15s ease !important;
    }
  `;
  
  const container = document.head || document.documentElement;
  if (container) {
    container.appendChild(style);
    console.log('[Keep Alive] Translate Mode highlight style added');
  }
}

// Tạo tooltip hiển thị bản dịch
function showTranslateTooltip(x, y, originalText, translatedText, isLoading = false) {
  // Xóa tooltip cũ nếu có
  const existingTooltip = document.getElementById('nhat-translate-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  const tooltip = document.createElement('div');
  tooltip.id = 'nhat-translate-tooltip';
  
  if (isLoading) {
    tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px; animation: spin 1s linear infinite;">⏳</span>
        <span>Đang dịch...</span>
      </div>
    `;
  } else {
    const langLabel = translateTargetLang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 English';
    
    // Phát hiện loại dịch từ icon: 📖 = offline, 🌐 = online
    const isOffline = translatedText.startsWith('📖');
    const cleanTranslation = translatedText.replace(/^(📖|🌐)\s*/, '');
    const sourceLabel = isOffline ? '📖 Offline' : '🌐 Google';
    
    tooltip.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 14px;">🈯</span>
            <span style="font-size: 11px; opacity: 0.9;">${langLabel}</span>
          </div>
          <span style="font-size: 9px; opacity: 0.8; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 10px;">${sourceLabel}</span>
        </div>
        <div style="font-size: 10px; opacity: 0.7; max-width: 280px; word-wrap: break-word;">
          <strong>原文:</strong> "${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}"
        </div>
        <div style="font-size: 13px; max-width: 280px; word-wrap: break-word; line-height: 1.5; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
          ${cleanTranslation}
        </div>
      </div>
    `;
  }
  
  // Tính toán vị trí tooltip
  let tooltipX = x;
  let tooltipY = y - 80;
  
  // Đảm bảo tooltip không vượt quá viewport
  if (tooltipY < 10) tooltipY = y + 30;
  if (tooltipX < 150) tooltipX = 150;
  if (tooltipX > window.innerWidth - 150) tooltipX = window.innerWidth - 150;
  
  tooltip.style.cssText = `
    position: fixed;
    top: ${tooltipY}px;
    left: ${tooltipX}px;
    transform: translateX(-50%);
    background: linear-gradient(135deg, rgba(33, 150, 243, 0.98), rgba(21, 101, 192, 0.98));
    color: white;
    padding: 12px 16px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 999999999;
    font-family: Arial, sans-serif;
    font-size: 12px;
    animation: translateTooltipIn 0.3s ease-out;
    pointer-events: none;
    max-width: 300px;
  `;
  
  // Thêm CSS animation nếu chưa có
  if (!document.getElementById('nhat-translate-tooltip-style')) {
    const style = document.createElement('style');
    style.id = 'nhat-translate-tooltip-style';
    style.textContent = `
      @keyframes translateTooltipIn {
        0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes translateTooltipOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }
  
  const container = document.body || document.documentElement;
  container.appendChild(tooltip);
  
  // Tự động xóa sau 5 giây (trừ khi đang loading)
  if (!isLoading) {
    setTimeout(() => {
      if (tooltip.parentElement) {
        tooltip.style.animation = 'translateTooltipOut 0.3s ease-out forwards';
        setTimeout(() => tooltip.remove(), 300);
      }
    }, 5000);
  }
  
  return tooltip;
}

// Hàm dịch text - Offline Dictionary + Google Translate Free
async function translateText(text, targetLang = 'en') {
  // Check cache trước
  const cacheKey = `${text}_${targetLang}`;
  if (translationCache[cacheKey]) {
    console.log('[Keep Alive] Translation from cache');
    return translationCache[cacheKey];
  }
  
  try {
    // 1. Thử dịch offline bằng dictionary trước
    if (typeof window !== 'undefined' && window.offlineDictionary) {
      const offlineResult = window.offlineDictionary.translate(text, targetLang);
      
      if (offlineResult.found && !offlineResult.partial) {
        const formatted = `📖 ${offlineResult.translated}`;
        translationCache[cacheKey] = formatted;
        saveTranslationCache(cacheKey, formatted);
        return formatted;
      }
    }
    
    // 2. Google Translate API miễn phí
    const sourceLang = 'ja';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    let translated = '';
    if (data && data[0]) {
      for (const part of data[0]) {
        if (part[0]) {
          translated += part[0];
        }
      }
    }
    
    if (translated) {
      const formatted = `🌐 ${translated}`;
      translationCache[cacheKey] = formatted;
      saveTranslationCache(cacheKey, formatted);
      return formatted;
    }
    
    return '[Không thể dịch]';
  } catch (error) {
    console.error('[Keep Alive] Translation error:', error);
    
    // Nếu offline, thử dùng dictionary
    if (typeof window !== 'undefined' && window.offlineDictionary) {
      const offlineResult = window.offlineDictionary.translate(text, targetLang);
      if (offlineResult.found) {
        return `📖 ${offlineResult.translated}`;
      }
    }
    
    return '[Lỗi - Không có mạng]';
  }
}

// Lưu translation cache vào localStorage
function saveTranslationCache(key, value) {
  try {
    const savedCache = JSON.parse(localStorage.getItem('nhat-translate-cache') || '{}');
    const cacheKeys = Object.keys(savedCache);
    if (cacheKeys.length > 100) {
      cacheKeys.slice(0, 20).forEach(k => delete savedCache[k]);
    }
    savedCache[key] = value;
    localStorage.setItem('nhat-translate-cache', JSON.stringify(savedCache));
  } catch (e) {
    // Ignore
  }
}

// Load translation cache từ localStorage
function loadTranslationCache() {
  try {
    const savedCache = JSON.parse(localStorage.getItem('nhat-translate-cache') || '{}');
    translationCache = savedCache;
    console.log('[Keep Alive] Loaded translation cache, entries:', Object.keys(savedCache).length);
  } catch (e) {
    translationCache = {};
  }
}

// Tạo floating indicator cho Translate Mode (CHỈ Ở TOP FRAME)
function createTranslateModeIndicator() {
  if (!isTopFrame) return;
  
  let indicator = document.getElementById('nhat-translate-mode-indicator');
  
  if (indicator) {
    updateTranslateModeIndicatorState(indicator);
    return;
  }
  
  indicator = document.createElement('div');
  indicator.id = 'nhat-translate-mode-indicator';
  updateTranslateModeIndicatorState(indicator);
  
  const defaultBg = translateModeEnabled 
    ? 'linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(21, 101, 192, 0.95))'
    : 'linear-gradient(135deg, #757575, #616161)';
  
  indicator.style.cssText = `
    position: fixed !important;
    bottom: 130px !important;
    right: 20px !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 20px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
    z-index: 2147483646 !important;
    font-family: Arial, sans-serif !important;
    cursor: pointer !important;
    user-select: none !important;
    display: ${showTranslateIndicator ? 'block' : 'none'} !important;
    visibility: ${showTranslateIndicator ? 'visible' : 'hidden'} !important;
    opacity: 1 !important;
    transition: background 0.3s ease !important;
    background: ${defaultBg} !important;
  `;
  
  // Drag and drop functionality
  let isDragging = false;
  let hasMoved = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  // Load vị trí đã lưu từ localStorage
  try {
    const savedPosition = localStorage.getItem('nhat-translate-indicator-position');
    if (savedPosition) {
      const pos = JSON.parse(savedPosition);
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      const minX = -window.innerWidth + 100;
      const minY = -window.innerHeight + 100;
      
      xOffset = Math.max(minX, Math.min(maxX, pos.x || 0));
      yOffset = Math.max(minY, Math.min(maxY, pos.y || 0));
      
      if (Math.abs(pos.x) > maxX || Math.abs(pos.y) > maxY) {
        xOffset = 0;
        yOffset = 0;
        localStorage.removeItem('nhat-translate-indicator-position');
      } else {
        indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    }
  } catch (e) {
    console.log('[Keep Alive] Could not load saved translate indicator position');
  }
  
  indicator.addEventListener('mousedown', (e) => {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    hasMoved = false;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      if (Math.abs(currentX - xOffset) > 5 || Math.abs(currentY - yOffset) > 5) {
        hasMoved = true;
      }
      
      xOffset = currentX;
      yOffset = currentY;
      indicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      
      try {
        localStorage.setItem('nhat-translate-indicator-position', JSON.stringify({
          x: xOffset,
          y: yOffset
        }));
      } catch (e) {
        console.log('[Keep Alive] Could not save translate indicator position');
      }
    }
  });
  
  // Click để bật/tắt Translate Mode
  indicator.addEventListener('click', (e) => {
    if (hasMoved) {
      hasMoved = false;
      return;
    }
    
    const newState = !translateModeEnabled;
    translateModeEnabled = newState;
    chrome.storage.local.set({ translateModeEnabled: newState });
    
    if (newState) {
      enableTranslateMode();
    } else {
      disableTranslateMode();
    }
  });
  
  const container = document.body || document.documentElement;
  container.appendChild(indicator);
  
  console.log('[Keep Alive] Translate Mode indicator created');
}

// Cập nhật trạng thái indicator Translate Mode
function updateTranslateModeIndicatorState(indicator) {
  if (!indicator) {
    indicator = document.getElementById('nhat-translate-mode-indicator');
  }
  if (!indicator) return;
  
  if (translateModeEnabled) {
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">🌐</span>
        <span style="font-size: 11px; font-weight: bold;">Dịch: BẬT</span>
      </div>
    `;
    indicator.style.background = 'linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(21, 101, 192, 0.95))';
  } else {
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">🌐</span>
        <span style="font-size: 11px; font-weight: bold;">Dịch: TẮT</span>
      </div>
    `;
    indicator.style.background = 'linear-gradient(135deg, #757575, #616161)';
  }
}

// Khởi tạo Translate Mode indicator
function initTranslateModeIndicator() {
  if (!isTopFrame) return;
  
  console.log('[Keep Alive] initTranslateModeIndicator called, showTranslateIndicator:', showTranslateIndicator);
  
  // Load translation cache
  loadTranslationCache();
  
  const isDOMReady = () => {
    return document.body || document.documentElement || document.readyState !== 'loading';
  };
  
  const doCreate = () => {
    console.log('[Keep Alive] Creating Translate Mode indicator...');
    createTranslateModeIndicator();
  };
  
  if (isDOMReady()) {
    doCreate();
  } else {
    document.addEventListener('DOMContentLoaded', doCreate, { once: true });
  }
}

// Xử lý hover event cho Translate Mode
function handleTranslateModeHover(e) {
  if (!translateModeEnabled || !translateModeActive) return;
  
  const target = e.target;
  
  // Bỏ qua các element của extension
  try {
    if (target.id && target.id.startsWith('nhat-')) return;
    if (target.closest && target.closest('#nhat-translate-mode-indicator')) return;
    if (target.closest && target.closest('#nhat-translate-tooltip')) return;
    if (target.closest && target.closest('#nhat-copy-mode-indicator')) return;
    if (target.closest && target.closest('#nhat-debug-indicator')) return;
  } catch (err) {}
  
  // Xóa highlight cũ
  if (lastTranslateElement && lastTranslateElement !== target) {
    try {
      lastTranslateElement.classList.remove('nhat-translate-highlight');
    } catch (err) {}
  }
  
  // Lấy text từ element
  const text = getTextFromElement(target);
  
  // Chỉ highlight nếu có text và text có vẻ là tiếng Nhật
  if (text && text.length > 0 && hasJapaneseCharacters(text)) {
    try {
      target.classList.add('nhat-translate-highlight');
      lastTranslateElement = target;
      
      // Nếu bật translateOnHover, tự động dịch khi hover
      if (translateOnHover) {
        clearTimeout(translateDebounceTimer);
        translateDebounceTimer = setTimeout(async () => {
          // Hiện tooltip loading
          const rect = target.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top;
          showTranslateTooltip(x, y, text, '', true);
          
          // Dịch text
          const translated = await translateText(text, translateTargetLang);
          
          // Cập nhật tooltip với kết quả
          showTranslateTooltip(x, y, text, translated, false);
        }, 500); // Debounce 500ms
      }
    } catch (err) {}
  }
}

// Kiểm tra text có chứa ký tự tiếng Nhật không
function hasJapaneseCharacters(text) {
  // Hiragana: \u3040-\u309F
  // Katakana: \u30A0-\u30FF
  // Kanji (CJK): \u4E00-\u9FAF
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(text);
}

// Xử lý click event để dịch
function handleTranslateModeClick(e) {
  if (!translateModeEnabled || !translateModeActive) return;
  
  const target = e.target;
  
  // Bỏ qua các element của extension
  try {
    if (target.id && target.id.startsWith('nhat-')) return;
    if (target.closest && target.closest('#nhat-translate-mode-indicator')) return;
    if (target.closest && target.closest('#nhat-translate-tooltip')) return;
    if (target.closest && target.closest('#nhat-copy-mode-indicator')) return;
    if (target.closest && target.closest('#nhat-debug-indicator')) return;
  } catch (err) {}
  
  // Lấy text từ element
  const text = getTextFromElement(target);
  
  if (text && text.length > 0 && hasJapaneseCharacters(text)) {
    e.preventDefault();
    e.stopPropagation();
    
    // Hiện tooltip loading
    showTranslateTooltip(e.clientX, e.clientY, text, '', true);
    
    // Dịch text
    translateText(text, translateTargetLang).then(translated => {
      showTranslateTooltip(e.clientX, e.clientY, text, translated, false);
    });
  }
}

// Xử lý mouse leave cho Translate Mode
function handleTranslateModeLeave(e) {
  if (!translateModeEnabled || !translateModeActive) return;
  
  const target = e.target;
  try {
    if (target.classList) {
      target.classList.remove('nhat-translate-highlight');
    }
  } catch (err) {}
  
  // Clear debounce timer
  clearTimeout(translateDebounceTimer);
}

// Bật Translate Mode
function enableTranslateMode() {
  console.log('[Keep Alive] enableTranslateMode called, translateModeActive:', translateModeActive);
  
  if (translateModeActive) {
    console.log('[Keep Alive] Translate Mode already active, skipping');
    return;
  }
  
  console.log('[Keep Alive] Translate Mode enabling...');
  
  const doEnable = () => {
    if (translateModeActive) return;
    
    translateModeActive = true;
    console.log('[Keep Alive] Translate Mode enabled');
    
    createTranslateModeIndicator();
    
    // Thêm event listeners
    document.addEventListener('mouseover', handleTranslateModeHover, true);
    document.addEventListener('click', handleTranslateModeClick, true);
    document.addEventListener('mouseout', handleTranslateModeLeave, true);
    
    console.log('[Keep Alive] Event listeners added for Translate Mode');
  };
  
  const isDOMReady = () => {
    return document.body || document.documentElement || document.readyState !== 'loading';
  };
  
  if (isDOMReady()) {
    doEnable();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doEnable, { once: true });
  } else {
    const waitForDOM = setInterval(() => {
      if (isDOMReady()) {
        clearInterval(waitForDOM);
        doEnable();
      }
    }, 50);
  }
}

// Tắt Translate Mode
function disableTranslateMode() {
  if (!translateModeActive) {
    console.log('[Keep Alive] Translate Mode already inactive, skipping');
    updateTranslateModeIndicatorState();
    return;
  }
  
  translateModeActive = false;
  console.log('[Keep Alive] Translate Mode disabled');
  
  updateTranslateModeIndicatorState();
  
  // Xóa highlight nếu có
  if (lastTranslateElement) {
    lastTranslateElement.classList.remove('nhat-translate-highlight');
    lastTranslateElement = null;
  }
  
  // Xóa tất cả highlight còn lại
  document.querySelectorAll('.nhat-translate-highlight').forEach(el => {
    el.classList.remove('nhat-translate-highlight');
  });
  
  // Xóa tooltip nếu có
  const tooltip = document.getElementById('nhat-translate-tooltip');
  if (tooltip) tooltip.remove();
  
  // Xóa event listeners
  document.removeEventListener('mouseover', handleTranslateModeHover, true);
  document.removeEventListener('click', handleTranslateModeClick, true);
  document.removeEventListener('mouseout', handleTranslateModeLeave, true);
  
  // Clear debounce timer
  clearTimeout(translateDebounceTimer);
}

// ==================== GOOGLE SHEETS HIGHLIGHTER ====================

// Kiểm tra có phải Google Sheets không
function isGoogleSheets() {
  return window.location.hostname === 'docs.google.com' && 
         window.location.pathname.includes('/spreadsheets/');
}

// Thêm CSS cho Google Sheets highlight
function addSheetsHighlightStyle() {
  if (document.getElementById('nhat-sheets-highlight-style')) return;
  
  const style = document.createElement('style');
  style.id = 'nhat-sheets-highlight-style';
  style.textContent = `
    #nhat-sheets-highlight-overlay {
      position: fixed;
      pointer-events: none;
      z-index: 999999;
      mix-blend-mode: multiply;
    }
    .nhat-sheets-row-bar {
      position: absolute;
      background-color: var(--nhat-highlight-color, #fff3cd);
      opacity: 0.5;
      pointer-events: none;
    }
    .nhat-sheets-col-bar {
      position: absolute;
      background-color: var(--nhat-highlight-color, #fff3cd);
      opacity: 0.5;
      pointer-events: none;
    }
    .nhat-sheets-cell-box {
      position: absolute;
      border: 2px solid #ff9800;
      background-color: var(--nhat-highlight-color, #fff3cd);
      opacity: 0.6;
      pointer-events: none;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// Cập nhật màu highlight
function updateSheetsHighlightColor() {
  document.documentElement.style.setProperty('--nhat-highlight-color', highlightColor);
}

// Lấy vị trí cell hiện tại từ Google Sheets
function getCurrentCellInfo() {
  // Tìm cell name box (ô hiển thị A1, B2, etc.) - thử nhiều selectors
  const selectors = [
    '#t-name-box',                           // ID của name box
    'input[aria-label="Name box"]',          // Input với aria-label
    'input.jfk-textinput',                   // Input class
    '[data-tooltip="Name box"]',             // Tooltip
    '.waffle-name-box',                      // Class cũ
    'input[id*="name"]',                     // ID chứa "name"
    '.docs-sheet-active-cell',               // Active cell indicator
  ];
  
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const cellRef = el.value || el.textContent || el.innerText || '';
      console.log('[Sheets] Name box found with selector:', selector, '-> Value:', cellRef);
      
      const match = cellRef.trim().match(/^([A-Z]+)(\d+)$/i);
      if (match) {
        return {
          col: match[1].toUpperCase(),
          row: parseInt(match[2]),
          ref: cellRef.toUpperCase().trim()
        };
      }
    }
  }
  
  // Thử tìm bằng cách khác - scan inputs trong vùng formula bar
  const allInputs = document.querySelectorAll('input');
  for (const input of allInputs) {
    const val = input.value || '';
    // Name box thường chứa giá trị như "A1", "B2", "R7", "S7" etc.
    if (/^[A-Z]+\d+$/i.test(val.trim())) {
      const rect = input.getBoundingClientRect();
      // Name box nằm ở góc trái trên, thường có width nhỏ (~50-80px)
      if (rect.width > 30 && rect.width < 150 && rect.top < 200) {
        console.log('[Sheets] Found name box by scanning inputs:', val, rect);
        const match = val.trim().match(/^([A-Z]+)(\d+)$/i);
        if (match) {
          return {
            col: match[1].toUpperCase(),
            row: parseInt(match[2]),
            ref: val.toUpperCase().trim()
          };
        }
      }
    }
  }
  
  console.log('[Sheets] Could not find Name Box');
  return null;
}

// Tính toán column index từ letter (A=1, B=2, ..., Z=26, AA=27, etc.)
function colLetterToIndex(col) {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index;
}

// Tạo/cập nhật overlay highlight
let sheetsOverlay = null;
let lastCellRef = '';
let lastClickedCell = null; // Lưu thông tin cell được click

function createSheetsOverlay() {
  if (sheetsOverlay) return sheetsOverlay;
  
  sheetsOverlay = document.createElement('div');
  sheetsOverlay.id = 'nhat-sheets-highlight-overlay';
  document.body.appendChild(sheetsOverlay);
  return sheetsOverlay;
}

function removeSheetsOverlay() {
  if (sheetsOverlay) {
    sheetsOverlay.remove();
    sheetsOverlay = null;
  }
  lastCellRef = '';
  lastClickedCell = null;
}

// Tìm vị trí column từ column header bar
function getColumnPosition(colLetter, gridRect) {
  // Tính column index từ letter (A=0, B=1, ..., Z=25, AA=26...)
  const colIndex = colLetterToIndex(colLetter) - 1;
  
  // Row header width (cột số hàng bên trái)
  const rowHeaderWidth = 46;
  
  // Default column width trong Google Sheets
  const defaultColWidth = 100;
  
  // Tính vị trí X của column
  // Column A bắt đầu sau row header
  const colLeft = gridRect.left + rowHeaderWidth + (colIndex * defaultColWidth);
  
  console.log('[Sheets] Column', colLetter, '(index:', colIndex, ') -> Left:', colLeft, '(grid.left:', gridRect.left, '+ rowHeader:', rowHeaderWidth, '+ col*100:', colIndex * defaultColWidth, ')');
  
  return {
    left: colLeft,
    width: defaultColWidth
  };
}

// Tìm vị trí row từ row number
function getRowPosition(rowNum, gridRect) {
  // Row index (1-based -> 0-based)
  const rowIndex = rowNum - 1;
  
  // Default row height trong Google Sheets
  const defaultRowHeight = 21;
  
  // Column headers height (hàng A, B, C... ở trên)
  const colHeaderHeight = 21;
  
  // Tính vị trí Y của row
  // Row 1 bắt đầu sau column headers
  const rowTop = gridRect.top + colHeaderHeight + (rowIndex * defaultRowHeight);
  
  console.log('[Sheets] Row', rowNum, '(index:', rowIndex, ') -> Top:', rowTop, '(grid.top:', gridRect.top, '+ colHeader:', colHeaderHeight, '+ row*21:', rowIndex * defaultRowHeight, ')');
  
  return {
    top: rowTop,
    height: defaultRowHeight
  };
}

function updateSheetsHighlight(clickEvent) {
  if (!sheetsHighlightEnabled) {
    removeSheetsOverlay();
    return;
  }
  
  let clickX, clickY;
  
  if (clickEvent && typeof clickEvent.clientX === 'number') {
    clickX = clickEvent.clientX;
    clickY = clickEvent.clientY;
    lastClickedCell = { x: clickX, y: clickY };
  } else if (lastClickedCell) {
    clickX = lastClickedCell.x;
    clickY = lastClickedCell.y;
  } else {
    return;
  }

  // Tạo overlay full screen cho crosshair
  const overlay = createSheetsOverlay();
  overlay.innerHTML = '';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;';
  
  // Lấy màu từ setting (dạng hex) và chuyển sang rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const lineColor = hexToRgba(highlightColor, 0.8);
  const dotColor = hexToRgba(highlightColor, 0.9);
  
  // Vẽ ĐƯỜNG NGANG - đi qua điểm click, full width màn hình
  if (highlightMode === 'row' || highlightMode === 'both') {
    const rowBar = document.createElement('div');
    rowBar.className = 'nhat-sheets-row-bar';
    rowBar.style.cssText = `
      position: fixed;
      left: 0;
      top: ${clickY}px;
      width: 100vw;
      height: 2px;
      background: ${lineColor};
      transform: translateY(-1px);
      box-shadow: 0 0 4px ${highlightColor};
    `;
    overlay.appendChild(rowBar);
  }
  
  // Vẽ ĐƯỜNG DỌC - đi qua điểm click, full height màn hình
  if (highlightMode === 'column' || highlightMode === 'both') {
    const colBar = document.createElement('div');
    colBar.className = 'nhat-sheets-col-bar';
    colBar.style.cssText = `
      position: fixed;
      left: ${clickX}px;
      top: 0;
      width: 2px;
      height: 100vh;
      background: ${lineColor};
      transform: translateX(-1px);
      box-shadow: 0 0 4px ${highlightColor};
    `;
    overlay.appendChild(colBar);
  }
  
  // Vẽ ĐIỂM CROSSHAIR tại vị trí click - nhỏ hơn và căn giữa chính xác
  const dot = document.createElement('div');
  const dotSize = 8;
  dot.style.cssText = `
    position: fixed;
    left: ${clickX}px;
    top: ${clickY}px;
    width: ${dotSize}px;
    height: ${dotSize}px;
    background: ${dotColor};
    border-radius: 50%;
    border: 1px solid ${highlightColor};
    box-shadow: 0 0 6px ${highlightColor};
    transform: translate(-50%, -50%);
  `;
  overlay.appendChild(dot);
}

// ==================== WEB CROSSHAIR INDICATOR ====================
let crosshairIndicator = null;

// Tạo floating indicator cho Crosshair (CHỈ Ở TOP FRAME)
// Indicator luôn hiện, chỉ đổi trạng thái BẬT/TẮT
function createCrosshairIndicator() {
  if (!isTopFrame) return;
  
  let indicator = document.getElementById('ka-crosshair-indicator');
  
  // Nếu đã có indicator, chỉ cập nhật trạng thái
  if (indicator) {
    updateCrosshairIndicatorState(indicator);
    return;
  }
  
  indicator = document.createElement('div');
  indicator.id = 'ka-crosshair-indicator';
  
  // Set text nội dung ngay
  indicator.innerHTML = sheetsHighlightEnabled ? '➕ Crosshair: BẬT' : '➕ Crosshair: TẮT';
  
  // Set màu mặc định dựa trên trạng thái
  const defaultBg = sheetsHighlightEnabled 
    ? 'linear-gradient(135deg, #e10e0e, #ff4444)'
    : 'linear-gradient(135deg, #757575, #616161)';
  
  indicator.style.cssText = `
    position: fixed !important;
    bottom: 140px !important;
    right: 20px !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 20px !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
    z-index: 2147483647 !important;
    font-family: Arial, sans-serif !important;
    cursor: pointer !important;
    user-select: none !important;
    display: ${showCrosshairIndicator ? 'block' : 'none'} !important;
    background: ${defaultBg} !important;
    font-size: 11px !important;
    font-weight: bold !important;
    transition: background 0.3s ease !important;
  `;
  
  // Drag and drop functionality
  let isDragging = false;
  let hasMoved = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;
  
  // Load vị trí đã lưu từ localStorage
  try {
    const savedPosition = localStorage.getItem('ka-crosshair-indicator-position');
    if (savedPosition) {
      const pos = JSON.parse(savedPosition);
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      const minX = -window.innerWidth + 100;
      const minY = -window.innerHeight + 100;
      
      xOffset = Math.max(minX, Math.min(maxX, pos.x || 0));
      yOffset = Math.max(minY, Math.min(maxY, pos.y || 0));
      
      if (Math.abs(pos.x) > maxX || Math.abs(pos.y) > maxY) {
        xOffset = 0;
        yOffset = 0;
        localStorage.removeItem('ka-crosshair-indicator-position');
      } else {
        indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    }
  } catch (e) {
    console.log('[Keep Alive] Could not load saved crosshair indicator position');
  }
  
  indicator.addEventListener('mousedown', (e) => {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    hasMoved = false;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      
      if (Math.abs(currentX - xOffset) > 5 || Math.abs(currentY - yOffset) > 5) {
        hasMoved = true;
      }
      
      xOffset = currentX;
      yOffset = currentY;
      indicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      
      try {
        localStorage.setItem('ka-crosshair-indicator-position', JSON.stringify({
          x: xOffset,
          y: yOffset
        }));
      } catch (e) {
        console.log('[Keep Alive] Could not save crosshair indicator position');
      }
    }
  });
  
  // Click để bật/tắt Crosshair (chỉ khi không kéo)
  indicator.addEventListener('click', (e) => {
    if (hasMoved) {
      hasMoved = false;
      return;
    }
    
    sheetsHighlightEnabled = !sheetsHighlightEnabled;
    safeStorageSet({ sheetsHighlightEnabled });
    if (sheetsHighlightEnabled) {
      enableSheetsHighlight();
    } else {
      disableSheetsHighlight();
    }
    updateCrosshairIndicatorState(indicator);
  });
  
  // Append vào body hoặc documentElement (cho frameset)
  const container = document.body || document.documentElement;
  container.appendChild(indicator);
  
  console.log('[Keep Alive] Crosshair indicator created');
}

function updateCrosshairIndicatorState(indicator) {
  if (!indicator) {
    indicator = document.getElementById('ka-crosshair-indicator');
  }
  if (!indicator) return;
  
  if (sheetsHighlightEnabled) {
    indicator.innerHTML = '➕ Crosshair: BẬT';
    indicator.style.background = 'linear-gradient(135deg, #e10e0e, #ff4444)';
  } else {
    indicator.innerHTML = '➕ Crosshair: TẮT';
    indicator.style.background = 'linear-gradient(135deg, #757575, #616161)';
  }
  
  indicator.style.display = showCrosshairIndicator ? 'block' : 'none';
}

// Khởi tạo Crosshair indicator khi DOM ready
function initCrosshairIndicator() {
  if (!isTopFrame) return;
  
  console.log('[Keep Alive] initCrosshairIndicator called, showCrosshairIndicator:', showCrosshairIndicator);
  
  const isDOMReady = () => {
    return document.body || document.documentElement || document.readyState !== 'loading';
  };
  
  const doCreate = () => {
    console.log('[Keep Alive] Creating Crosshair indicator...');
    createCrosshairIndicator();
  };
  
  if (isDOMReady()) {
    doCreate();
  } else {
    document.addEventListener('DOMContentLoaded', doCreate, { once: true });
  }
}

function updateCrosshairIndicator() {
  updateCrosshairIndicatorState();
}

// Theo dõi selection thay đổi
let sheetsHighlightInterval = null;
let sheetsClickHandler = null;
let sheetsKeyHandler = null;
let sheetsScrollHandler = null;

function enableSheetsHighlight() {
  if (sheetsHighlightActive) return;
  
  sheetsHighlightActive = true;
  console.log('[Keep Alive] Web Crosshair enabled');
  
  updateSheetsHighlightColor();
  updateCrosshairIndicator();
  
  // Cập nhật khi click vào bất kỳ đâu
  sheetsClickHandler = (e) => {
    // Truyền click event để biết vị trí click
    setTimeout(() => updateSheetsHighlight(e), 50);
  };
  
  // Cập nhật khi dùng keyboard navigation
  sheetsKeyHandler = (e) => {
    // Arrow keys, Enter, Tab - các phím di chuyển
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.key)) {
      setTimeout(() => updateSheetsHighlight(null), 50);
    }
    // ESC để tắt crosshair
    if (e.key === 'Escape') {
      removeSheetsOverlay();
      lastClickedCell = null;
    }
  };
  
  // Ẩn crosshair khi scroll
  sheetsScrollHandler = () => {
    removeSheetsOverlay();
    lastClickedCell = null;
  };
  
  document.addEventListener('click', sheetsClickHandler, true);
  document.addEventListener('keydown', sheetsKeyHandler, true);
  document.addEventListener('scroll', sheetsScrollHandler, true);
  document.addEventListener('wheel', sheetsScrollHandler, true);
  
  // Cập nhật ngay lập tức khi bật
  setTimeout(() => updateSheetsHighlight(null), 100);
}

function disableSheetsHighlight() {
  if (!sheetsHighlightActive) return;
  
  sheetsHighlightActive = false;
  console.log('[Keep Alive] Web Crosshair disabled');
  
  if (sheetsHighlightInterval) {
    clearInterval(sheetsHighlightInterval);
    sheetsHighlightInterval = null;
  }
  
  // Remove event listeners
  if (sheetsClickHandler) {
    document.removeEventListener('click', sheetsClickHandler, true);
    sheetsClickHandler = null;
  }
  if (sheetsKeyHandler) {
    document.removeEventListener('keydown', sheetsKeyHandler, true);
    sheetsKeyHandler = null;
  }
  if (sheetsScrollHandler) {
    document.removeEventListener('scroll', sheetsScrollHandler, true);
    document.removeEventListener('wheel', sheetsScrollHandler, true);
    sheetsScrollHandler = null;
  }
  
  removeSheetsOverlay();
  updateCrosshairIndicator();
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Xóa highlight (không cần nữa với overlay approach)
function clearSheetsHighlight() {
  removeSheetsOverlay();
}

// ==================== SCRIPT LOADER ====================
// Inject scripts as early as possible to try bypassing CSP
(function injectUserScripts() {
  const currentUrl = window.location.href;
  console.log('[ScriptLoader] Content script loaded for:', currentUrl);
  
  // Skip chrome:// and extension pages
  if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
    return;
  }
  
  // Check if URL matches pattern
  function matchesPattern(url, pattern) {
    try {
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp('^' + escaped + '$');
      return regex.test(url);
    } catch (e) {
      return false;
    }
  }
  
  // Inject script using background (chrome.scripting.executeScript with MAIN world)
  // Blob URL is blocked by CSP on many sites, so we go directly to background method
  function injectScript(content, name) {
    injectViaBackground(content, name);
  }
  
  // Show CSP warning notification
  function showCSPWarning(scriptName) {
    // Wait for DOM to be ready
    function showWarning() {
      if (!document.body) {
        setTimeout(showWarning, 100);
        return;
      }
      
      const existing = document.getElementById('scriptloader-csp-warning');
      if (existing) existing.remove();
      
      const warning = document.createElement('div');
      warning.id = 'scriptloader-csp-warning';
      warning.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 24px;">⚠️</span>
          <div>
            <div style="font-weight: bold; margin-bottom: 5px;">Script bị chặn</div>
            <div style="font-size: 12px; opacity: 0.9;">
              Trang này có chính sách bảo mật nghiêm ngặt (CSP/Trusted Types) 
              không cho phép chạy script bên ngoài.
            </div>
            <div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">
              Script: ${scriptName}
            </div>
          </div>
          <button id="scriptloader-csp-close"
            style="background: none; border: none; color: white; cursor: pointer; 
                   font-size: 18px; padding: 0; margin-left: auto;">×</button>
        </div>
      `;
      warning.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b6b 0%, #c0392b 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        max-width: 350px;
        animation: scriptloader-slideIn 0.3s ease;
      `;
      
      // Add animation keyframes
      if (!document.getElementById('scriptloader-csp-style')) {
        const style = document.createElement('style');
        style.id = 'scriptloader-csp-style';
        style.textContent = `
          @keyframes scriptloader-slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head?.appendChild(style);
      }
      
      document.body.appendChild(warning);
      
      // Add close button handler
      document.getElementById('scriptloader-csp-close')?.addEventListener('click', () => {
        warning.remove();
      });
      
      // Auto remove after 8 seconds
      setTimeout(() => warning.remove(), 8000);
    }
    
    showWarning();
  }
  
  // Fallback: Ask background to inject
  function injectViaBackground(content, name) {
    chrome.runtime.sendMessage({
      action: 'executeUserScript',
      scriptContent: content,
      scriptName: name
    }, (response) => {
      if (response?.success) {
        console.log(`[ScriptLoader] ✅ Injected by background: ${name}`);
      } else {
        console.error(`[ScriptLoader] ❌ All methods failed for: ${name}`, response?.error);
        // Show warning to user
        showCSPWarning(name);
      }
    });
  }
  
  // Get scripts and inject
  chrome.storage.local.get(['userScripts'], (result) => {
    const scripts = result.userScripts || [];
    const isTopFrame = (window === window.top);
    
    scripts.forEach(script => {
      if (!script.enabled) return;
      
      // Check if script should run in iframes
      // Default is true (run in all frames) if not specified
      const runInIframes = script.runInIframes !== false;
      if (!isTopFrame && !runInIframes) {
        // Script is set to only run in top frame, skip iframe
        return;
      }
      
      const matches = script.matches || ['*://*/*'];
      const shouldInject = matches.some(pattern => matchesPattern(currentUrl, pattern));
      
      if (!shouldInject) return;
      
      // Check if script already injected in this frame (avoid duplicates)
      const injectedKey = `__scriptloader_injected_${script.id}`;
      if (window[injectedKey]) {
        console.log(`[ScriptLoader] Already injected, skipping: ${script.name}`);
        return;
      }
      window[injectedKey] = true;
      
      console.log(`[ScriptLoader] Preparing to inject: ${script.name}`);
      
      // Wait for head/documentElement to be ready
      function tryInject() {
        if (document.head || document.documentElement) {
          injectScript(script.content, script.name);
        } else {
          requestAnimationFrame(tryInject);
        }
      }
      
      if (document.readyState === 'loading') {
        // Try immediately for early injection
        tryInject();
      } else {
        injectScript(script.content, script.name);
      }
    });
  });
})();

// ==================== SCREENSHOT CAPTURE MODULE ====================
(function() {
  if (!isTopFrame) return; // Chỉ chạy ở top frame

  let screenshotOverlay = null;
  let isSelecting = false;
  let startX = 0, startY = 0;
  let selectionBox = null;
  let screenshotScale = 2;
  let screenshotSaveFile = false;
  let screenshotModeEnabled = false;
  let showScreenshotIndicator = true;

  // Load trạng thái từ storage
  safeStorageGet(['screenshotScale', 'screenshotSaveFile', 'screenshotModeEnabled', 'showScreenshotIndicator'], (result) => {
    screenshotScale = parseInt(result.screenshotScale) || 2;
    screenshotSaveFile = result.screenshotSaveFile || false;
    screenshotModeEnabled = result.screenshotModeEnabled || false;
    showScreenshotIndicator = result.showScreenshotIndicator !== false;
    initScreenshotIndicator();
  });

  // ── Indicator nổi ──────────────────────────────────────────────
  function createScreenshotIndicator() {
    let indicator = document.getElementById('ka-screenshot-indicator');
    if (indicator) { updateScreenshotIndicatorState(indicator); return; }

    indicator = document.createElement('div');
    indicator.id = 'ka-screenshot-indicator';
    indicator.innerHTML = '📸 Chụp ngay';

    indicator.style.cssText = `
      position: fixed !important;
      bottom: 100px !important;
      right: 20px !important;
      color: white !important;
      padding: 8px 12px !important;
      border-radius: 20px !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
      z-index: 2147483647 !important;
      font-family: Arial, sans-serif !important;
      cursor: pointer !important;
      user-select: none !important;
      display: ${showScreenshotIndicator ? 'block' : 'none'} !important;
      background: linear-gradient(135deg, #00bcd4, #0097a7) !important;
      font-size: 11px !important;
      font-weight: bold !important;
    `;

    // Drag
    let isDragging = false, hasMoved = false;
    let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
    try {
      const saved = localStorage.getItem('ka-screenshot-indicator-position');
      if (saved) {
        const pos = JSON.parse(saved);
        xOffset = pos.x || 0; yOffset = pos.y || 0;
        indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      }
    } catch(e) {}

    indicator.addEventListener('mousedown', (e) => {
      initialX = e.clientX - xOffset; initialY = e.clientY - yOffset;
      isDragging = true; hasMoved = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX; currentY = e.clientY - initialY;
      if (Math.abs(currentX - xOffset) > 5 || Math.abs(currentY - yOffset) > 5) hasMoved = true;
      xOffset = currentX; yOffset = currentY;
      indicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        try { localStorage.setItem('ka-screenshot-indicator-position', JSON.stringify({ x: xOffset, y: yOffset })); } catch(e) {}
      }
    });

    // Click = chụp ngay luôn (không bật/tắt)
    indicator.addEventListener('click', (e) => {
      if (hasMoved) { hasMoved = false; return; }
      safeStorageGet(['screenshotScale', 'screenshotSaveFile'], (r) => {
        screenshotScale = parseInt(r.screenshotScale) || 2;
        screenshotSaveFile = r.screenshotSaveFile || false;
        createOverlay();
      });
    });

    const container = document.body || document.documentElement;
    container.appendChild(indicator);
  }

  function updateScreenshotIndicatorState(indicator) {
    if (!indicator) indicator = document.getElementById('ka-screenshot-indicator');
    if (!indicator) return;
    indicator.style.display = showScreenshotIndicator ? 'block' : 'none';
  }

  function initScreenshotIndicator() {
    const doCreate = () => createScreenshotIndicator();
    if (document.body || document.documentElement) {
      doCreate();
    } else {
      document.addEventListener('DOMContentLoaded', doCreate, { once: true });
    }
  }

  // ── Toast ──────────────────────────────────────────────────────
  function showScreenshotToast(msg, color = '#333', duration = 2500, onClick = null) {
    let toast = document.getElementById('nhat-screenshot-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nhat-screenshot-toast';
      document.body.appendChild(toast);
    }
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: ${color}; color: #fff; padding: 10px 20px; border-radius: 8px;
      font-size: 13px; font-family: sans-serif; z-index: 2147483647;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: opacity 0.3s; opacity: 1; white-space: nowrap;
      cursor: ${onClick ? 'pointer' : 'default'}; pointer-events: ${onClick ? 'auto' : 'none'};
    `;
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.onclick = onClick || null;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; toast.onclick = null; }, duration);
  }

  // ── Selection overlay ──────────────────────────────────────────
  function getAbsoluteCoords(e) {
    return { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
  }

  function createOverlay() {
    removeOverlay();

    screenshotOverlay = document.createElement('div');
    screenshotOverlay.id = 'nhat-screenshot-overlay';
    screenshotOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 2147483646; cursor: crosshair; background: rgba(0,0,0,0.01);
      user-select: none; -webkit-user-select: none;
    `;

    const hint = document.createElement('div');
    hint.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.75); color: #fff; padding: 8px 16px;
      border-radius: 20px; font-size: 13px; font-family: sans-serif;
      pointer-events: none; white-space: nowrap; z-index: 1;
    `;
    hint.textContent = '🖱️ Kéo để chọn vùng chụp  •  ESC để hủy';
    screenshotOverlay.appendChild(hint);

    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: absolute; border: 2px dashed #00bcd4; background: rgba(0,188,212,0.08);
      pointer-events: none; display: none; box-sizing: border-box;
    `;
    screenshotOverlay.appendChild(selectionBox);

    document.body.appendChild(screenshotOverlay);

    screenshotOverlay.addEventListener('mousedown', onMouseDown, { passive: false });
    document.addEventListener('mousemove', onMouseMove, { passive: false });
    document.addEventListener('mouseup', onMouseUp, { passive: false });
    document.addEventListener('keydown', onKeyDown, { passive: false });
  }

  function removeOverlay() {
    if (screenshotOverlay) {
      screenshotOverlay.removeEventListener('mousedown', onMouseDown);
      screenshotOverlay.remove();
      screenshotOverlay = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    isSelecting = false;
    selectionBox = null;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      removeOverlay();
      showScreenshotToast('❌ Đã hủy chụp màn hình', '#555');
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isSelecting = true;
    const coords = getAbsoluteCoords(e);
    startX = coords.x; startY = coords.y;
    if (selectionBox) {
      selectionBox.style.display = 'block';
      selectionBox.style.left = e.clientX + 'px';
      selectionBox.style.top  = e.clientY + 'px';
      selectionBox.style.width = '0';
      selectionBox.style.height = '0';
    }
  }

  function onMouseMove(e) {
    if (!isSelecting || !selectionBox) return;
    e.preventDefault();
    const abs = getAbsoluteCoords(e);
    const x = Math.min(startX, abs.x) - window.scrollX;
    const y = Math.min(startY, abs.y) - window.scrollY;
    selectionBox.style.left   = x + 'px';
    selectionBox.style.top    = y + 'px';
    selectionBox.style.width  = Math.abs(abs.x - startX) + 'px';
    selectionBox.style.height = Math.abs(abs.y - startY) + 'px';
  }

  function onMouseUp(e) {
    if (!isSelecting) return;
    e.preventDefault();
    isSelecting = false;
    const absEnd = getAbsoluteCoords(e);
    const x = Math.round(Math.min(startX, absEnd.x));
    const y = Math.round(Math.min(startY, absEnd.y));
    const w = Math.round(Math.abs(absEnd.x - startX));
    const h = Math.round(Math.abs(absEnd.y - startY));
    removeOverlay();
    if (w < 5 || h < 5) { showScreenshotToast('⚠️ Vùng chọn quá nhỏ, thử lại', '#f57c00'); return; }
    captureRegion(x, y, w, h);
  }

  // ── Capture ────────────────────────────────────────────────────
  async function captureRegion(x, y, w, h) {
    showScreenshotToast('⏳ Đang chụp...', '#1565c0', 5000);
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        });
      });
      if (!response || !response.dataUrl) throw new Error(response?.error || 'Không chụp được ảnh');

      const img = await loadImage(response.dataUrl);
      const scaleX = img.naturalWidth / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;
      const vx = x - (response.scrollX || 0);
      const vy = y - (response.scrollY || 0);
      const cropX = Math.round(vx * scaleX);
      const cropY = Math.round(vy * scaleY);
      const cropW = Math.round(w * scaleX);
      const cropH = Math.round(h * scaleY);
      if (cropW <= 0 || cropH <= 0) throw new Error('Vùng chọn không hợp lệ');

      const canvas = document.createElement('canvas');
      canvas.width  = cropW * screenshotScale;
      canvas.height = cropH * screenshotScale;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

      // Lưu ảnh JPEG nhỏ gọn để tích hợp Gemini
      try {
        const geminiImg = canvas.toDataURL('image/jpeg', 0.92);
        chrome.storage.local.set({ geminiPendingImage: geminiImg, geminiPendingTs: Date.now() }).catch(() => {});
      } catch(e) {}

      canvas.toBlob(async (blob) => {
        if (!blob) { showScreenshotToast('❌ Không tạo được ảnh', '#c62828'); return; }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          // Đọc service đang chọn rồi mới show toast
          safeStorageGet(['chatAiService'], (cfg) => {
            const svc = cfg.chatAiService || 'gemini';
            const svcLabel = { gemini: 'Gemini', chatgpt: 'ChatGPT', copilot: 'Copilot' }[svc] || 'AI';
            showScreenshotToast(`✅ Đã copy ảnh! Nhấn để hỏi ${svcLabel} 🤖`, '#2e7d32', 5000, () => {
              chrome.runtime.sendMessage({ action: 'openChatAiWindow', service: svc });
            });
          });
        } catch (clipErr) {
          downloadBlob(blob, `screenshot_${Date.now()}.png`);
          showScreenshotToast('📥 Clipboard bị chặn, đã tải file thay thế', '#f57c00');
        }
        if (screenshotSaveFile) downloadBlob(blob, `screenshot_${Date.now()}.png`);
      }, 'image/png');
    } catch (err) {
      console.error('[Screenshot] Error:', err);
      showScreenshotToast('❌ Lỗi: ' + err.message, '#c62828');
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Phím tắt Alt+S ────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      safeStorageGet(['screenshotScale', 'screenshotSaveFile'], (r) => {
        screenshotScale = parseInt(r.screenshotScale) || 2;
        screenshotSaveFile = r.screenshotSaveFile || false;
        createOverlay();
      });
    }
  });

  // ── Callback từ popup ─────────────────────────────────────────
  window.__screenshotStartCallback = function(scale, saveFile) {
    screenshotScale = parseInt(scale) || 2;
    screenshotSaveFile = saveFile || false;
    createOverlay();
  };

  // ── Handle message toggleScreenshotIndicator ──────────────────
  window.__screenshotToggleIndicator = function(show) {
    showScreenshotIndicator = (show !== false);
    updateScreenshotIndicatorState();
  };
})();

// ── Chat AI Integration (Gemini / ChatGPT / Copilot) ────────────────────────
(function() {
  if (!isTopFrame) return;

  const host = window.location.hostname;
  const isGemini  = host.includes('gemini.google.com');
  const isChatGPT = host.includes('chat.openai.com');
  const isCopilot = host.includes('copilot.microsoft.com');
  if (!isGemini && !isChatGPT && !isCopilot) return;

  // Tìm input chat tuỳ từng trang
  function findChatInput() {
    if (isGemini) {
      return document.querySelector('rich-textarea .ql-editor[contenteditable="true"]')
        || document.querySelector('[data-placeholder][contenteditable="true"]')
        || document.querySelector('div[role="textbox"]')
        || document.querySelector('textarea');
    }
    if (isChatGPT) {
      return document.querySelector('#prompt-textarea')
        || document.querySelector('textarea[placeholder]')
        || document.querySelector('div[contenteditable="true"]');
    }
    if (isCopilot) {
      return document.querySelector('textarea[aria-label]')
        || document.querySelector('div[contenteditable="true"]')
        || document.querySelector('textarea');
    }
    return null;
  }

  function showAiBanner(text) {
    let el = document.getElementById('ka-ai-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ka-ai-banner';
      const style = document.createElement('style');
      style.textContent = '@keyframes kaFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(style);
      document.body.appendChild(el);
    }
    const bgColor = isGemini ? 'linear-gradient(135deg,#1a73e8,#4285f4)'
                  : isChatGPT ? 'linear-gradient(135deg,#10a37f,#0d8c6c)'
                  : 'linear-gradient(135deg,#0078d4,#005a9e)';
    el.style.cssText = `
      position:fixed!important;bottom:80px!important;right:20px!important;
      background:${bgColor}!important;
      color:#fff!important;padding:10px 14px!important;border-radius:10px!important;
      font-size:12px!important;font-family:sans-serif!important;line-height:1.6!important;
      z-index:2147483647!important;box-shadow:0 4px 16px rgba(0,0,0,0.25)!important;
      max-width:240px!important;pointer-events:none!important;
      opacity:1!important;animation:kaFadeIn 0.3s ease!important;
    `;
    el.innerHTML = text;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 7000);
  }

  function tryFocusAndNotify() {
    // Thử nhiều lần vì trang AI load chậm
    let attempts = 0;
    const tryFocus = () => {
      const input = findChatInput();
      if (input) {
        input.click();
        input.focus();
        showAiBanner('📸 Ảnh đã copy vào clipboard!<br><b>Nhấn Ctrl+V</b> để dán vào chat');
      } else if (attempts < 8) {
        attempts++;
        setTimeout(tryFocus, 600);
      } else {
        showAiBanner('📸 Ảnh đã copy vào clipboard!<br><b>Nhấn Ctrl+V</b> để dán vào chat');
      }
    };
    tryFocus();
  }

  // Lắng nghe ảnh mới từ screenshot
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiPendingTs) setTimeout(tryFocusAndNotify, 600);
  });

  // Kiểm tra khi trang vừa load (mở cửa sổ mới sau khi chụp)
  chrome.storage.local.get(['geminiPendingTs'], (r) => {
    if (!r.geminiPendingTs) return;
    if (Date.now() - r.geminiPendingTs < 30000) setTimeout(tryFocusAndNotify, 2000);
  });
})();

// ── Chat AI Floating Bubble ──────────────────────────────────────────────────
// Theo đúng pattern của createCopyModeIndicator / createFloatingIndicator

let chatBubbleEl = null;
let isChatBubbleMinimized = false;

function getChatServiceLabel(service) {
  const labels = { gemini: '✨ Gemini', chatgpt: '💬 ChatGPT', copilot: '🔷 Copilot' };
  return labels[service] || '🤖 Chat AI';
}

function getChatServiceColor(service) {
  const colors = {
    gemini: 'linear-gradient(135deg, #1a73e8, #4285f4)',
    chatgpt: 'linear-gradient(135deg, #10a37f, #0d8c6c)',
    copilot: 'linear-gradient(135deg, #0078d4, #005a9e)'
  };
  return colors[service] || 'linear-gradient(135deg, #1a73e8, #4285f4)';
}

function createChatBubbleIndicator() {
  if (!isTopFrame) return;

  // Nếu đã có, chỉ cập nhật trạng thái
  let indicator = document.getElementById('ka-chat-bubble');
  if (indicator) {
    updateChatBubbleAppearance(indicator);
    return;
  }

  indicator = document.createElement('div');
  indicator.id = 'ka-chat-bubble';

  // Khai báo drag vars TRƯỚC khi dùng trong updateChatBubbleAppearance
  let isDragging = false;
  let hasMoved = false;
  let currentX, currentY, initialX, initialY;
  let xOffset = 0, yOffset = 0;

  // Load vị trí đã lưu từ localStorage
  try {
    const savedPosition = localStorage.getItem('ka-chat-bubble-position');
    if (savedPosition) {
      const pos = JSON.parse(savedPosition);
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 100;
      const minX = -window.innerWidth + 100;
      const minY = -window.innerHeight + 100;
      xOffset = Math.max(minX, Math.min(maxX, pos.x || 0));
      yOffset = Math.max(minY, Math.min(maxY, pos.y || 0));
      if (Math.abs(pos.x) > maxX || Math.abs(pos.y) > maxY) {
        xOffset = 0; yOffset = 0;
        localStorage.removeItem('ka-chat-bubble-position');
      }
    }
  } catch (e) {
    console.log('[Keep Alive] Could not load saved chat bubble position');
  }

  // Hàm cập nhật giao diện, dùng xOffset/yOffset từ closure
  function updateAppearance() {
    const tf = `translate(${xOffset}px, ${yOffset}px)`;
    const shouldShow = showChatBubble && chatBubbleEnabled;

    if (isChatBubbleMinimized) {
      indicator.style.cssText = `
        position: fixed !important;
        bottom: 160px !important;
        right: 20px !important;
        width: 26px !important;
        height: 26px !important;
        border-radius: 50% !important;
        background: rgba(80,80,80,0.5) !important;
        border: 2px solid rgba(255,255,255,0.6) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        z-index: 2147483647 !important;
        cursor: pointer !important;
        display: ${shouldShow ? 'flex' : 'none'} !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 13px !important;
        transform: ${tf} !important;
        user-select: none !important;
      `;
      indicator.innerHTML = '🙈';
      indicator.title = 'Nhấn để mở lại';
    } else {
      indicator.style.cssText = `
        position: fixed !important;
        bottom: 160px !important;
        right: 20px !important;
        background: ${getChatServiceColor(chatAiService)} !important;
        color: white !important;
        border-radius: 24px !important;
        box-shadow: 0 3px 12px rgba(0,0,0,0.35) !important;
        z-index: 2147483647 !important;
        font-family: Arial, sans-serif !important;
        cursor: pointer !important;
        user-select: none !important;
        display: ${shouldShow ? 'flex' : 'none'} !important;
        align-items: center !important;
        font-size: 12px !important;
        font-weight: bold !important;
        overflow: hidden !important;
        transform: ${tf} !important;
        min-width: 90px !important;
        transition: box-shadow 0.2s !important;
      `;
      indicator.title = '';
      indicator.innerHTML = `
        <span class="ka-chat-label" style="padding: 9px 10px 9px 14px; flex: 1; white-space: nowrap; pointer-events: none;">${getChatServiceLabel(chatAiService)}</span>
        <span class="ka-chat-eye" title="Ẩn tạm" style="padding: 9px 10px 9px 8px; font-size: 14px; border-left: 1px solid rgba(255,255,255,0.3); flex-shrink: 0; cursor: pointer; pointer-events: auto;">👁️</span>
      `;

      // Gắn sự kiện nút mắt
      const eyeBtn = indicator.querySelector('.ka-chat-eye');
      if (eyeBtn) {
        eyeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        eyeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          isChatBubbleMinimized = true;
          updateAppearance();
          try { chrome.runtime.sendMessage({ action: 'minimizeChatAiWindow' }); } catch(err) {}
        });
      }
    }
  }

  // Áp dụng ngay lần đầu
  updateAppearance();

  // Set transform nếu có vị trí lưu
  if (xOffset !== 0 || yOffset !== 0) {
    indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
  }

  // Drag: mousedown
  indicator.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('ka-chat-eye')) return;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    hasMoved = false;
  });

  // Drag: mousemove
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    if (Math.abs(currentX - xOffset) > 5 || Math.abs(currentY - yOffset) > 5) {
      hasMoved = true;
    }
    xOffset = currentX;
    yOffset = currentY;
    indicator.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
  });

  // Drag: mouseup – lưu vị trí
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      try {
        localStorage.setItem('ka-chat-bubble-position', JSON.stringify({ x: xOffset, y: yOffset }));
      } catch (e) {
        console.log('[Keep Alive] Could not save chat bubble position');
      }
    }
  });

  // Click: mở chat hoặc khôi phục từ minimized
  indicator.addEventListener('click', (e) => {
    if (hasMoved) { hasMoved = false; return; }
    if (e.target.classList.contains('ka-chat-eye')) return;

    if (isChatBubbleMinimized) {
      // Chấm 🙈 → mở lại bubble
      isChatBubbleMinimized = false;
      updateAppearance();
    } else {
      // Bubble đầy đủ → mở cửa sổ chat
      try { chrome.runtime.sendMessage({ action: 'openChatAiWindow', service: chatAiService }); } catch(err) {}
    }
  });

  // Lưu hàm updateAppearance để public API dùng được
  indicator._updateAppearance = updateAppearance;
  chatBubbleEl = indicator;

  const container = document.body || document.documentElement;
  container.appendChild(indicator);

  console.log('[Keep Alive] Chat Bubble indicator created');
}

// Cập nhật giao diện bubble (khi không có closure, dùng _updateAppearance đã lưu)
function updateChatBubbleAppearance(indicator) {
  if (!indicator) indicator = document.getElementById('ka-chat-bubble');
  if (!indicator) return;
  if (typeof indicator._updateAppearance === 'function') {
    indicator._updateAppearance();
  }
}

// Khởi tạo Chat Bubble khi DOM ready (chỉ khi chatBubbleEnabled)
function initChatBubbleIndicator() {
  if (!isTopFrame) return;
  if (!chatBubbleEnabled) return;

  console.log('[Keep Alive] initChatBubbleIndicator called, chatBubbleEnabled:', chatBubbleEnabled);

  const isDOMReady = () => document.body || document.documentElement || document.readyState !== 'loading';

  const doCreate = () => {
    console.log('[Keep Alive] Creating Chat Bubble indicator...');
    createChatBubbleIndicator();
  };

  if (isDOMReady()) {
    doCreate();
  } else {
    document.addEventListener('DOMContentLoaded', doCreate, { once: true });
  }
}

// ── Public API (được gọi từ message handler) ──────────────────────────────────
window.__chatBubbleToggle = function(enabled) {
  chatBubbleEnabled = enabled;
  if (enabled) {
    const existing = document.getElementById('ka-chat-bubble');
    if (!existing) {
      initChatBubbleIndicator();
    } else {
      updateChatBubbleAppearance(existing);
    }
  } else {
    // Tắt: ẩn bubble (không xoá hẳn để giữ state drag)
    if (chatBubbleEl) {
      chatBubbleEl.style.display = 'none';
    } else {
      const el = document.getElementById('ka-chat-bubble');
      if (el) el.style.display = 'none';
    }
  }
};

window.__chatBubbleSetVisible = function(show) {
  showChatBubble = show;
  const el = chatBubbleEl || document.getElementById('ka-chat-bubble');
  if (el && typeof el._updateAppearance === 'function') {
    el._updateAppearance();
  }
};

window.__chatBubbleSetService = function(service) {
  chatAiService = service;
  const el = chatBubbleEl || document.getElementById('ka-chat-bubble');
  if (el && typeof el._updateAppearance === 'function') {
    el._updateAppearance();
  }
};


