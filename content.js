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

// Chỉ chạy trong top frame, không chạy trong iframe
const isTopFrame = (window === window.top);

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
chrome.storage.local.get(['language', 'showIndicator', 'copyModeEnabled', 'showCopyIndicator'], (result) => {
  const savedLang = result.language || 'vi';
  loadLanguage(savedLang);
  
  // Load showIndicator state (default true)
  showIndicator = result.showIndicator !== undefined ? result.showIndicator : true;
  
  // Load showCopyIndicator state (default true)
  showCopyIndicator = result.showCopyIndicator !== undefined ? result.showCopyIndicator : true;
  
  // Load copyModeEnabled state (default false) - CHẠY Ở TẤT CẢ FRAMES
  copyModeEnabled = result.copyModeEnabled || false;
  
  // LUÔN tạo indicator ở top frame (để người dùng có thể click bật/tắt)
  // Sau đó mới ẩn/hiện dựa trên showCopyIndicator
  if (isTopFrame) {
    initCopyModeIndicator();
  }
  
  // LUÔN thêm CSS highlight vào TẤT CẢ FRAMES (kể cả frame con)
  addCopyModeHighlightStyle();
  
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
  
  // Ẩn/hiện indicator dựa trên setting
  const indicator = document.getElementById('nhat-debug-indicator');
  if (indicator) {
    indicator.style.display = showIndicator ? 'block' : 'none';
  }
});

// Listen for language changes and showIndicator changes
chrome.storage.onChanged.addListener((changes, namespace) => {
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
});

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
chrome.storage.local.get(['isEnabled', 'isRecording'], (result) => {
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
chrome.storage.onChanged.addListener((changes, namespace) => {
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
          chrome.runtime.sendMessage({ action: 'getRecordedRequests' }, (response) => {
            if (chrome.runtime.lastError) return;
            if (response && response.requests) {
              updateIndicator(response.requests.length);
            }
          });
        } catch (e) {
          // Extension context invalid
        }
      } else {
        updateIndicator();
      }
    }
  }
});

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