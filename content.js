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
safeStorageGet(['language', 'showIndicator', 'copyModeEnabled', 'showCopyIndicator', 'translateModeEnabled', 'showTranslateIndicator', 'translateOnHover', 'translateTargetLang', 'sheetsHighlightEnabled', 'highlightMode', 'highlightColor'], (result) => {
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
  
  // LUÔN tạo indicator ở top frame (để người dùng có thể click bật/tắt)
  // Sau đó mới ẩn/hiện dựa trên showCopyIndicator
  if (isTopFrame) {
    initCopyModeIndicator();
    initTranslateModeIndicator();
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
});

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
  
  // Ưu tiên các thuộc tính có text
  if (element.value && typeof element.value === 'string') {
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
    if (target.closest && target.closest('#nhat-debug-indicator')) return;
    if (target.closest && target.closest('#nhat-devtools-button')) return;
  } catch (err) {
    // Bỏ qua lỗi closest
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
        <span style="font-size: 14px;">🈯</span>
        <span style="font-size: 11px; font-weight: bold;">Dịch: BẬT</span>
      </div>
    `;
    indicator.style.background = 'linear-gradient(135deg, rgba(33, 150, 243, 0.95), rgba(21, 101, 192, 0.95))';
  } else {
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14px;">🈯</span>
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
// Scripts will be injected by background.js via chrome.scripting.executeScript
// Content script just needs to be present to trigger injection
console.log('[ScriptLoader] Content script loaded for:', window.location.href);