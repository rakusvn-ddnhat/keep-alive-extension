console.log('[Background] Service worker started');

let isRecording = false;
let recordedRequests = [];
let domainFilter = ''; // Domain filter

// Lắng nghe khi bật/tắt recording
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isRecording && typeof changes.isRecording.newValue !== 'undefined') {
      isRecording = changes.isRecording.newValue;
      if (isRecording) {
        recordedRequests = [];
        chrome.storage.local.set({ cachedRequests: [] }).catch(() => {}); // Clear cache khi bắt đầu recording mới
        console.log('[Recording] Started with domain filter:', domainFilter);
      } else {
        console.log('[Recording] Stopped. Total requests:', recordedRequests.length);
      }
    }
    
    if (changes.domainFilter && typeof changes.domainFilter.newValue !== 'undefined') {
      domainFilter = changes.domainFilter.newValue || '';
      console.log('[Recording] Domain filter updated:', domainFilter);
    }
  }
});

// Khởi tạo trạng thái (khôi phục requests từ storage nếu có)
chrome.storage.local.get(['isRecording', 'domainFilter', 'cachedRequests']).then((result) => {
  if (result && typeof result.isRecording !== 'undefined') {
    isRecording = result.isRecording;
  } else {
    isRecording = false;
  }
  domainFilter = result.domainFilter || '';
  
  // Khôi phục requests đã lưu (để tránh mất khi reload page)
  if (result.cachedRequests && Array.isArray(result.cachedRequests)) {
    recordedRequests = result.cachedRequests;
    console.log('[Background] Restored', recordedRequests.length, 'cached requests');
  }
  
  console.log('[Background] Initial state - Recording:', isRecording, 'Domain:', domainFilter);
}).catch((error) => {
  // Bỏ qua lỗi "No SW" khi service worker bị terminate
  if (!error.message.includes('No SW')) {
    console.error('[Background] Error loading initial state:', error);
  }
  isRecording = false;
  domainFilter = '';
});

// Hàm kiểm tra xem có phải request tĩnh không (CSS, JS, images...)
function isStaticResource(url) {
  const staticExtensions = ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp', '.mp4', '.mp3'];
  const lowerUrl = url.toLowerCase();
  return staticExtensions.some(ext => lowerUrl.includes(ext));
}

// Hàm kiểm tra xem có phải XHR/Fetch request không
function isApiRequest(type) {
  // Bắt cả main_frame (navigation/page load) để catch MVC endpoints
  return type === 'xmlhttprequest' || type === 'fetch' || type === 'other' || type === 'main_frame' || type === 'sub_frame';
}

// Listener cho request body (PHẢI đăng ký TRƯỚC onBeforeSendHeaders)
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isRecording) return;
    
    // Bỏ qua static files
    if (isStaticResource(details.url)) return;
    
    // Bỏ qua chrome extension URLs
    if (details.url.startsWith('chrome-extension://')) return;
    
    // Chỉ xử lý API requests
    if (!isApiRequest(details.type)) return;
    
    // Kiểm tra domain filter
    if (typeof domainFilter === 'string' && domainFilter.trim() !== '') {
      try {
        const url = new URL(details.url);
        if (!url.hostname.includes(domainFilter.trim())) {
          return;
        }
      } catch (e) {
        return;
      }
    }
    
    // Tạo request object tạm thời để lưu body
    let tempRequest = recordedRequests.find(req => req.requestId === details.requestId);
    if (!tempRequest) {
      tempRequest = {
        url: details.url,
        method: details.method,
        headers: {},
        timestamp: new Date().toISOString(),
        type: details.type,
        requestId: details.requestId
      };
      recordedRequests.push(tempRequest);
    }
    
    // Lưu request body nếu có
    if (details.requestBody) {
      if (details.requestBody.formData) {
        // Convert formData object {key: [value1, value2]} thành URLSearchParams format
        const formParams = new URLSearchParams();
        for (const [key, values] of Object.entries(details.requestBody.formData)) {
          if (Array.isArray(values)) {
            values.forEach(value => formParams.append(key, value));
          } else {
            formParams.append(key, values);
          }
        }
        tempRequest.body = formParams.toString();
        tempRequest.bodyType = 'form-urlencoded';
        console.log('[Recording] Captured formData:', Object.keys(details.requestBody.formData).length, 'params');
      } else if (details.requestBody.raw) {
        const decoder = new TextDecoder('utf-8');
        const rawData = details.requestBody.raw.map(item => decoder.decode(item.bytes));
        tempRequest.body = rawData.join('');
        tempRequest.bodyType = 'raw';
        console.log('[Recording] Captured raw body:', tempRequest.body.substring(0, 100));
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Lắng nghe request trước khi gửi đi (để lấy headers)
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!isRecording) {
      // Không log để tránh spam console
      return;
    }
    
    // Bỏ qua static files trước
    if (isStaticResource(details.url)) {
      return;
    }
    
    // Chỉ bắt XHR/Fetch/Navigation và các request tới server
    if (!isApiRequest(details.type)) {
      console.log('[Recording] Skipped - not API request, type:', details.type, details.url);
      return;
    }
    
    // Bỏ qua chrome extension URLs
    if (details.url.startsWith('chrome-extension://')) {
      return;
    }
    
    // Kiểm tra domain filter
    if (typeof domainFilter === 'string' && domainFilter.trim() !== '') {
      try {
        const url = new URL(details.url);
        if (!url.hostname.includes(domainFilter.trim())) {
          console.log('[Recording] Skipped - domain not match. Expected:', domainFilter, 'Got:', url.hostname);
          return;
        }
      } catch (e) {
        console.error('[Recording] Invalid URL:', details.url, e);
        return;
      }
    }
    
    // Tìm hoặc tạo request object
    let request = recordedRequests.find(req => req.requestId === details.requestId);
    if (!request) {
      request = {
        url: details.url,
        method: details.method,
        headers: {},
        timestamp: new Date().toISOString(),
        type: details.type,
        requestId: details.requestId
      };
      recordedRequests.push(request);
    }
    
    // Lưu headers
    if (details.requestHeaders) {
      details.requestHeaders.forEach(header => {
        request.headers[header.name] = header.value;
      });
    }
    
    console.log('[Recording] Captured API call:', details.method, details.url, request.body ? 'with body' : 'no body');
    
    // Lưu vào storage để tránh mất khi reload page
    chrome.storage.local.set({ cachedRequests: recordedRequests }).catch((error) => {
      // Bỏ qua lỗi "No SW"
      if (!error.message.includes('No SW')) {
        console.error('[Recording] Error saving to storage:', error);
      }
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

// Lắng nghe message từ popup để export
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.action);
  
  try {
    if (message.action === 'getRecordedRequests') {
      console.log('[Background] Sending', recordedRequests.length, 'requests');
      sendResponse({ requests: recordedRequests });
    } else if (message.action === 'exportCurl') {
      if (recordedRequests.length === 0) {
        sendResponse({ success: false, error: 'Không có request nào để export!' });
        return true;
      }
      const curlCommands = recordedRequests.map(req => generateCurl(req)).join('\n\n');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadFile(`recorded_requests_${timestamp}.sh`, curlCommands);
      sendResponse({ success: true });
    } else if (message.action === 'exportJMeter') {
      if (recordedRequests.length === 0) {
        sendResponse({ success: false, error: 'Không có request nào để export!' });
        return true;
      }
      const jmx = generateJMeter(recordedRequests);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadFile(`recorded_requests_${timestamp}.jmx`, jmx);
      sendResponse({ success: true });
    } else if (message.action === 'clearRequests') {
      recordedRequests = [];
      chrome.storage.local.set({ cachedRequests: [] }).catch(() => {});
      console.log('[Background] Cleared all recorded requests');
      sendResponse({ success: true });
    } else if (message.action === 'updateRequests') {
      // Cập nhật danh sách requests (khi xóa từng item)
      recordedRequests = message.requests || [];
      chrome.storage.local.set({ cachedRequests: recordedRequests }).catch(() => {});
      console.log('[Background] Updated requests, now have:', recordedRequests.length);
      sendResponse({ success: true });
    }
    // Script Loader handlers
    else if (message.action === 'getScripts') {
      getScripts().then(scripts => sendResponse(scripts));
      return true;
    } else if (message.action === 'addScript') {
      addScript(message.data).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'removeScript') {
      removeScript(message.scriptId).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'toggleScript') {
      toggleScript(message.scriptId, message.enabled).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'updateScript') {
      updateScript(message.scriptId).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'checkForUpdates') {
      checkForUpdates().then(result => sendResponse(result));
      return true;
    } else if (message.action === 'getScriptsForUrl') {
      getScriptsForUrl(message.url).then(scripts => sendResponse(scripts));
      return true;
    } else if (message.action === 'getScriptById') {
      getScriptById(message.scriptId).then(script => sendResponse(script));
      return true;
    } else if (message.action === 'updateScriptVariables') {
      updateScriptVariables(message.scriptId, message.variables, message.runInIframes).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'addScriptFromContent') {
      addScriptFromContent(message.data).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'reloadScript') {
      reloadScript(message.scriptId).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'reloadLocalScript') {
      reloadLocalScript(message.scriptId, message.content, message.fileName).then(result => sendResponse(result));
      return true;
    } else if (message.action === 'executeUserScript') {
      // Execute user script in MAIN world using chrome.scripting API
      // Pass frameId to inject only in the specific frame that requested it
      executeUserScriptInTab(sender.tab.id, sender.frameId, message.scriptContent, message.scriptName)
        .then(result => sendResponse(result));
      return true;
    } else if (message.action === 'downloadUpdate') {
      // Download extension update ZIP
      chrome.downloads.download({
        url: message.url,
        filename: message.filename || 'DevToolbox-update.zip',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[Background] Download error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('[Background] Download started:', downloadId);
          sendResponse({ success: true, downloadId });
        }
      });
      return true;
    }
  } catch (error) {
    console.error('[Background] Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  return true;
});

// Tạo cURL command
function generateCurl(request) {
  let curl = `curl -X ${request.method} '${request.url}'`;
  
  // Thêm headers
  for (const [name, value] of Object.entries(request.headers)) {
    // Bỏ qua một số headers tự động
    if (!['host', 'connection', 'content-length'].includes(name.toLowerCase())) {
      curl += ` \\\n  -H '${name}: ${value}'`;
    }
  }
  
  // Thêm body nếu có
  if (request.body) {
    curl += ` \\\n  -d '${request.body.replace(/'/g, "\\'")}'`;
  }
  
  return curl;
}

// Tạo JMeter JMX file (simplified version)
function generateJMeter(requests) {
  let samplers = '';
  
  requests.forEach((req, index) => {
    const url = new URL(req.url);
    const protocol = url.protocol.replace(':', '');
    const domain = url.hostname;
    const port = url.port || (protocol === 'https' ? '443' : '80');
    const path = url.pathname;
    
    let headers = '';
    for (const [name, value] of Object.entries(req.headers)) {
      headers += `          <elementProp name="" elementType="Header">
            <stringProp name="Header.name">${escapeXml(name)}</stringProp>
            <stringProp name="Header.value">${escapeXml(value)}</stringProp>
          </elementProp>\n`;
    }
    
    // Xử lý parameters (query params hoặc body params)
    let argumentsXml = '';
    let allParams = new Map();
    
    // 1. Thêm query parameters từ URL
    if (url.search) {
      const params = new URLSearchParams(url.search);
      params.forEach((value, key) => {
        allParams.set(key, value);
      });
    }
    
    // 2. Thêm body parameters
    if (req.body) {
      const contentType = req.headers['Content-Type'] || req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Parse multipart/form-data body
        try {
          const lines = req.body.split('\n');
          let currentField = null;
          let currentValue = '';
          let isFileField = false;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Tìm Content-Disposition header
            if (line.includes('Content-Disposition: form-data')) {
              // Lưu field trước đó nếu có
              if (currentField && !isFileField && currentValue.trim()) {
                allParams.set(currentField, currentValue.trim());
              }
              
              // Extract field name
              const nameMatch = line.match(/name="([^"]+)"/);
              const filenameMatch = line.match(/filename="([^"]+)"/);
              
              if (nameMatch) {
                currentField = nameMatch[1];
                currentValue = '';
                isFileField = false;
                
                // Nếu có filename, lưu tên file làm giá trị cho param
                if (filenameMatch) {
                  isFileField = true;
                  allParams.set(currentField, `@${filenameMatch[1]}`); // Thêm @ prefix để chỉ là file
                }
              }
            } else if (currentField && !isFileField && !line.startsWith('Content-') && !line.startsWith('--')) {
              // Đây là giá trị của text field (không phải file)
              if (line.trim() !== '') {
                currentValue += line;
              }
            }
          }
          
          // Lưu field cuối cùng
          if (currentField && !isFileField && currentValue.trim()) {
            allParams.set(currentField, currentValue.trim());
          }
          
          console.log('[JMeter] Parsed', allParams.size, 'fields from multipart data');
        } catch (e) {
          console.error('[JMeter] Error parsing multipart body:', e);
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Parse form-urlencoded body
        try {
          const bodyParams = new URLSearchParams(req.body);
          bodyParams.forEach((value, key) => {
            allParams.set(key, value);
          });
        } catch (e) {
          console.error('[JMeter] Error parsing form body:', e);
        }
      } else if (contentType.includes('application/json')) {
        // Parse JSON body
        try {
          const jsonData = JSON.parse(req.body);
          Object.entries(jsonData).forEach(([key, value]) => {
            allParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
          });
        } catch (e) {
          console.error('[JMeter] Error parsing JSON body:', e);
        }
      }
    }
    
    // 3. Tạo XML cho tất cả parameters
    allParams.forEach((value, key) => {
      argumentsXml += `            <elementProp name="${escapeXml(key)}" elementType="HTTPArgument">
              <boolProp name="HTTPArgument.always_encode">true</boolProp>
              <stringProp name="Argument.name">${escapeXml(key)}</stringProp>
              <stringProp name="Argument.value">${escapeXml(value)}</stringProp>
              <stringProp name="Argument.metadata">=</stringProp>
              <boolProp name="HTTPArgument.use_equals">true</boolProp>
            </elementProp>\n`;
    });
    
    const argumentsSection = `        <elementProp name="HTTPsampler.Arguments" elementType="Arguments" guiclass="HTTPArgumentsPanel" testclass="Arguments" enabled="true">
          <collectionProp name="Arguments.arguments">
${argumentsXml}          </collectionProp>
        </elementProp>`;
    
    samplers += `      <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="Request ${index + 1} - ${req.method} ${path}" enabled="true">
${argumentsSection}
        <stringProp name="HTTPSampler.domain">${domain}</stringProp>
        <stringProp name="HTTPSampler.port">${port}</stringProp>
        <stringProp name="HTTPSampler.protocol">${protocol}</stringProp>
        <stringProp name="HTTPSampler.contentEncoding"></stringProp>
        <stringProp name="HTTPSampler.path">${escapeXml(path)}</stringProp>
        <stringProp name="HTTPSampler.method">${req.method}</stringProp>
        <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
        <boolProp name="HTTPSampler.auto_redirects">false</boolProp>
        <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
        <boolProp name="HTTPSampler.DO_MULTIPART_POST">false</boolProp>
        <stringProp name="HTTPSampler.embedded_url_re"></stringProp>
        <stringProp name="HTTPSampler.connect_timeout"></stringProp>
        <stringProp name="HTTPSampler.response_timeout"></stringProp>
      </HTTPSamplerProxy>
      <hashTree>
        <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="HTTP Header Manager" enabled="true">
          <collectionProp name="HeaderManager.headers">
${headers}          </collectionProp>
        </HeaderManager>
        <hashTree/>
      </hashTree>
`;
  });
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.4.1">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Recorded Test Plan" enabled="true">
      <stringProp name="TestPlan.comments">Generated by Nhất Debug Tool</stringProp>
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" guiclass="ArgumentsPanel" testclass="Arguments" enabled="true">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
      <stringProp name="TestPlan.user_define_classpath"></stringProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">1</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">1</stringProp>
        <stringProp name="ThreadGroup.ramp_time">1</stringProp>
        <longProp name="ThreadGroup.start_time">1371789657000</longProp>
        <longProp name="ThreadGroup.end_time">1371789657000</longProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <stringProp name="ThreadGroup.duration"></stringProp>
        <stringProp name="ThreadGroup.delay"></stringProp>
      </ThreadGroup>
      <hashTree>
${samplers}      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// ==================== ZABBIX CHARTS BACKGROUND PROCESSING ====================
// Xử lý download/PDF trong background để không bị mất khi popup đóng

// Lưu trạng thái nhiều tiến trình download
let zabbixDownloadTasks = {}; // { taskId: { active, current, total, percent, type, tabId, completed, success, error } }
let taskIdCounter = 0;

// Lắng nghe yêu cầu từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'zabbixDownloadImages') {
    // Bắt đầu download images trong background
    const taskId = ++taskIdCounter;
    zabbixDownloadTasks[taskId] = { 
      active: true, current: 0, total: 0, percent: 0, 
      type: 'images', tabId: message.tabId, startTime: Date.now() 
    };
    downloadZabbixImages(message.tabId, taskId);
    sendResponse({ success: true, taskId: taskId, message: 'Started in background' });
    return true;
  }
  
  if (message.action === 'zabbixExportPdf') {
    // Bắt đầu thu thập ảnh cho PDF trong background
    const taskId = ++taskIdCounter;
    zabbixDownloadTasks[taskId] = { 
      active: true, current: 0, total: 0, percent: 0, 
      type: 'pdf', tabId: message.tabId, startTime: Date.now() 
    };
    collectZabbixChartsForPdf(message.tabId, taskId);
    sendResponse({ success: true, taskId: taskId, message: 'Started in background' });
    return true;
  }
  
  if (message.action === 'getZabbixDownloadStatus') {
    // Trả về tất cả tasks đang chạy hoặc vừa hoàn thành (trong 10 giây)
    const now = Date.now();
    const activeTasks = {};
    for (const [id, task] of Object.entries(zabbixDownloadTasks)) {
      // Giữ lại task đang active hoặc completed trong 10 giây gần đây
      if (task.active || (task.completedTime && (now - task.completedTime) < 10000)) {
        activeTasks[id] = task;
      }
    }
    sendResponse({ tasks: activeTasks });
    return true;
  }
  
  // Forward progress từ content script
  if (message.action === 'zabbixDownloadProgress' || message.action === 'zabbixPdfProgress') {
    // Cập nhật task tương ứng
    if (message.taskId && zabbixDownloadTasks[message.taskId]) {
      zabbixDownloadTasks[message.taskId].current = message.current;
      zabbixDownloadTasks[message.taskId].total = message.total;
      zabbixDownloadTasks[message.taskId].percent = message.percent;
    }
  }
});

// Download tất cả ảnh Zabbix
async function downloadZabbixImages(tabId, taskId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      args: [taskId],
      func: async (taskId) => {
        const images = document.querySelectorAll('#charts img, .flickerfreescreen img');
        if (images.length === 0) {
          return { success: false, error: 'noCharts' };
        }
        
        const total = images.length;
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
            
            // Gửi progress update với taskId
            const percent = Math.round((downloaded / total) * 100);
            chrome.runtime.sendMessage({ 
              action: 'zabbixDownloadProgress', 
              taskId: taskId,
              current: downloaded, 
              total: total,
              percent: percent 
            });
            
            await new Promise(r => setTimeout(r, 300));
          } catch (e) {
            console.error('Error downloading:', name, e);
          }
        }
        
        return { success: true, count: downloaded, total: total };
      }
    });
    
    const result = results[0]?.result;
    if (zabbixDownloadTasks[taskId]) {
      zabbixDownloadTasks[taskId] = { 
        ...zabbixDownloadTasks[taskId],
        active: false, 
        current: result?.count || 0, 
        total: result?.total || result?.count || 0, 
        percent: 100, 
        completed: true,
        completedTime: Date.now(),
        success: result?.success,
        error: result?.error
      };
    }
  } catch (err) {
    console.error('[Zabbix] Download error:', err);
    if (zabbixDownloadTasks[taskId]) {
      zabbixDownloadTasks[taskId] = { 
        ...zabbixDownloadTasks[taskId],
        active: false, 
        error: err.message,
        completedTime: Date.now()
      };
    }
  }
}

// Thu thập ảnh cho PDF
async function collectZabbixChartsForPdf(tabId, taskId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      args: [taskId],
      func: async (taskId) => {
        const images = document.querySelectorAll('#charts img, .flickerfreescreen img');
        if (images.length === 0) {
          return { success: false, error: 'Không tìm thấy charts' };
        }
        
        const total = images.length;
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
            
            // Gửi progress update với taskId
            const current = chartData.length;
            const percent = Math.round((current / total) * 100);
            chrome.runtime.sendMessage({ 
              action: 'zabbixPdfProgress', 
              taskId: taskId,
              current: current, 
              total: total,
              percent: percent 
            });
          } catch (e) {
            console.error('Error fetching:', name, e);
          }
        }
        
        return { success: true, charts: chartData, total: total };
      }
    });
    
    const result = results[0]?.result;
    if (result?.success && result.charts?.length > 0) {
      // Save to storage and open PDF generator
      await chrome.storage.local.set({ zabbixCharts: result.charts });
      chrome.tabs.create({ url: chrome.runtime.getURL('zabbix-pdf.html') });
      
      if (zabbixDownloadTasks[taskId]) {
        zabbixDownloadTasks[taskId] = { 
          ...zabbixDownloadTasks[taskId],
          active: false, 
          current: result.charts.length, 
          total: result.total, 
          percent: 100, 
          completed: true,
          completedTime: Date.now(),
          success: true
        };
      }
    } else {
      if (zabbixDownloadTasks[taskId]) {
        zabbixDownloadTasks[taskId] = { 
          ...zabbixDownloadTasks[taskId],
          active: false, 
          error: result?.error || 'Không có charts',
          completedTime: Date.now()
        };
      }
    }
  } catch (err) {
    console.error('[Zabbix] PDF collect error:', err);
    if (zabbixDownloadTasks[taskId]) {
      zabbixDownloadTasks[taskId] = { 
        ...zabbixDownloadTasks[taskId],
        active: false, 
        error: err.message,
        completedTime: Date.now()
      };
    }
  }
}

function downloadFile(filename, content) {
  // Dùng MIME type chung application/octet-stream để Chrome không tự động đổi đuôi file
  const mimeType = 'application/octet-stream';
  
  // Convert content to base64 data URL (workaround for service worker)
  const blob = btoa(unescape(encodeURIComponent(content)));
  const dataUrl = `data:${mimeType};base64,${blob}`;
  
  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true,
    conflictAction: 'uniquify'
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[Download] Error:', chrome.runtime.lastError);
    } else {
      console.log('[Download] Started:', downloadId, 'as', filename);
    }
  });
}

// ==================== SCRIPT LOADER SYSTEM ====================
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

// Parse GitHub URL (support blob or raw)
function parseGitHubUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Support raw.githubusercontent.com
    if (urlObj.hostname === 'raw.githubusercontent.com') {
      const parts = urlObj.pathname.split('/').filter(p => p);
      if (parts.length >= 4) {
        return {
          owner: parts[0],
          repo: parts[1],
          branch: parts[2],
          path: parts.slice(3).join('/')
        };
      }
    }
    
    // Support github.com/owner/repo/blob/branch/path
    if (urlObj.hostname === 'github.com' && urlObj.pathname.includes('/blob/')) {
      const parts = urlObj.pathname.split('/').filter(p => p);
      if (parts.length >= 5 && parts[2] === 'blob') {
        return {
          owner: parts[0],
          repo: parts[1],
          branch: parts[3],
          path: parts.slice(4).join('/')
        };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Fetch script content from GitHub
async function fetchScriptContent(repoInfo) {
  const rawUrl = `${GITHUB_RAW_BASE}/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${repoInfo.path}`;
  
  try {
    const response = await fetch(rawUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const content = await response.text();
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Parse UserScript metadata from content
function parseScriptMetadata(content) {
  const metadata = {
    name: 'Unnamed Script',
    version: '1.0',
    description: '',
    author: '',
    matches: [],
    includes: [],
    excludes: [],
    variables: [] // Configurable variables
  };
  
  const metaBlock = content.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  if (metaBlock) {
    const lines = metaBlock[0].split('\n');
    lines.forEach(line => {
      const match = line.match(/\/\/ @(\w+)\s+(.+)/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        
        if (key === 'name') metadata.name = value;
        else if (key === 'version') metadata.version = value;
        else if (key === 'description') metadata.description = value;
        else if (key === 'author') metadata.author = value;
        else if (key === 'match') metadata.matches.push(value);
        else if (key === 'include') metadata.includes.push(value);
        else if (key === 'exclude') metadata.excludes.push(value);
      }
    });
  }
  
  // Parse configurable variables (const varName = 'value'; // comment)
  const varRegex = /const\s+(\w+)\s*=\s*['"]([^'"]*)['"]\s*;\s*\/\/\s*(.+)/g;
  let varMatch;
  while ((varMatch = varRegex.exec(content)) !== null) {
    metadata.variables.push({
      name: varMatch[1],
      value: varMatch[2],
      description: varMatch[3].trim()
    });
  }
  
  return metadata;
}

// Get all scripts from storage
async function getScripts() {
  const result = await chrome.storage.local.get(['userScripts']);
  return result.userScripts || [];
}

// Add new script
async function addScript(data) {
  const { url } = data;
  
  // Parse GitHub URL
  const repoInfo = parseGitHubUrl(url);
  if (!repoInfo) {
    return { success: false, error: 'Invalid GitHub URL' };
  }
  
  // Fetch script content
  const fetchResult = await fetchScriptContent(repoInfo);
  if (!fetchResult.success) {
    return { success: false, error: fetchResult.error };
  }
  
  // Parse metadata and variables
  const metadata = parseScriptMetadata(fetchResult.content);
  
  // Create script object
  const script = {
    id: Date.now().toString(),
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author,
    matches: metadata.matches.length > 0 ? metadata.matches : ['*://*/*'],
    includes: metadata.includes,
    excludes: metadata.excludes,
    variables: metadata.variables, // Configurable variables
    content: fetchResult.content,
    url: url,
    sourceUrl: `${GITHUB_RAW_BASE}/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/${repoInfo.path}`,
    repoInfo: repoInfo,
    enabled: true,
    lastUpdated: Date.now(),
    hasUpdate: false
  };
  
  // Save to storage
  const scripts = await getScripts();
  scripts.push(script);
  await chrome.storage.local.set({ userScripts: scripts });
  
  return { success: true, script };
}

// Add script from local file content
async function addScriptFromContent(data) {
  const { name, content, source } = data;
  
  // Parse metadata and variables
  const metadata = parseScriptMetadata(content);
  
  // Create script object
  const script = {
    id: Date.now().toString(),
    name: metadata.name || name.replace('.js', '').replace('.user', ''),
    version: metadata.version || '1.0.0',
    description: metadata.description || 'Local script',
    author: metadata.author || 'Local',
    matches: metadata.matches.length > 0 ? metadata.matches : ['*://*/*'],
    includes: metadata.includes,
    excludes: metadata.excludes,
    variables: metadata.variables,
    content: content,
    url: null, // No URL for local scripts
    sourceUrl: null,
    repoInfo: null,
    source: source || 'local', // Mark as local file
    enabled: true,
    lastUpdated: Date.now(),
    hasUpdate: false
  };
  
  // Save to storage
  const scripts = await getScripts();
  scripts.push(script);
  await chrome.storage.local.set({ userScripts: scripts });
  
  return { success: true, script };
}

// Reload script from URL (for URL-based scripts)
async function reloadScript(scriptId) {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === scriptId);
  
  if (!script) {
    return { success: false, error: 'Script not found' };
  }
  
  if (!script.sourceUrl && !script.repoInfo) {
    return { success: false, error: 'Cannot reload local script' };
  }
  
  try {
    // Fetch new content
    let content;
    if (script.sourceUrl) {
      const response = await fetch(script.sourceUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to fetch: ${response.status}` };
      }
      content = await response.text();
    } else if (script.repoInfo) {
      const fetchResult = await fetchScriptContent(script.repoInfo);
      if (!fetchResult.success) {
        return { success: false, error: fetchResult.error };
      }
      content = fetchResult.content;
    }
    
    // Re-parse metadata
    const metadata = parseScriptMetadata(content);
    
    // Preserve user-modified variable values
    const oldVariables = script.variables || [];
    const newVariables = metadata.variables || [];
    
    // Merge: keep user values for existing variables, add new ones
    for (const newVar of newVariables) {
      const oldVar = oldVariables.find(v => v.name === newVar.name);
      if (oldVar) {
        newVar.value = oldVar.value; // Preserve user value
      }
    }
    
    // Apply user variable values to content
    for (const variable of newVariables) {
      const oldPattern = new RegExp(
        `(const\\s+${variable.name}\\s*=\\s*['"])([^'"]*)(["']\\s*;)`,
        'g'
      );
      content = content.replace(oldPattern, `$1${variable.value}$3`);
    }
    
    // Update script with all new metadata
    script.content = content;
    script.name = metadata.name || script.name;
    script.version = metadata.version || script.version;
    script.description = metadata.description || script.description;
    script.matches = metadata.matches.length > 0 ? metadata.matches : script.matches;
    script.includes = metadata.includes;
    script.excludes = metadata.excludes;
    script.variables = newVariables;
    script.lastUpdated = Date.now();
    script.hasUpdate = false;
    
    await chrome.storage.local.set({ userScripts: scripts });
    return { success: true, script };
  } catch (error) {
    console.error('[Background] Error reloading script:', error);
    return { success: false, error: error.message };
  }
}

// Reload local script with new file content
async function reloadLocalScript(scriptId, content, fileName) {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === scriptId);
  
  if (!script) {
    return { success: false, error: 'Script not found' };
  }
  
  try {
    // Re-parse metadata
    const metadata = parseScriptMetadata(content);
    
    // Preserve user-modified variable values
    const oldVariables = script.variables || [];
    const newVariables = metadata.variables || [];
    
    // Merge: keep user values for existing variables, add new ones
    for (const newVar of newVariables) {
      const oldVar = oldVariables.find(v => v.name === newVar.name);
      if (oldVar) {
        newVar.value = oldVar.value;
      }
    }
    
    // Apply user variable values to content
    for (const variable of newVariables) {
      const oldPattern = new RegExp(
        `(const\\s+${variable.name}\\s*=\\s*['"])([^'"]*)(["']\\s*;)`,
        'g'
      );
      content = content.replace(oldPattern, `$1${variable.value}$3`);
    }
    
    // Update script with all new metadata
    script.content = content;
    script.name = metadata.name || fileName?.replace('.js', '').replace('.user', '') || script.name;
    script.version = metadata.version || script.version;
    script.description = metadata.description || script.description;
    script.matches = metadata.matches.length > 0 ? metadata.matches : script.matches;
    script.includes = metadata.includes;
    script.excludes = metadata.excludes;
    script.variables = newVariables;
    script.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ userScripts: scripts });
    return { success: true, script };
  } catch (error) {
    console.error('[Background] Error reloading local script:', error);
    return { success: false, error: error.message };
  }
}

// Remove script
async function removeScript(scriptId) {
  const scripts = await getScripts();
  const filtered = scripts.filter(s => s.id !== scriptId);
  await chrome.storage.local.set({ userScripts: filtered });
  return { success: true };
}

// Toggle script enabled/disabled
async function toggleScript(scriptId, enabled) {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === scriptId);
  if (script) {
    script.enabled = enabled;
    await chrome.storage.local.set({ userScripts: scripts });
  }
  return { success: true };
}

// Update script variables (configurable params)
async function updateScriptVariables(scriptId, newVariables, runInIframes) {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === scriptId);
  
  if (!script) {
    return { success: false, error: 'Script not found' };
  }
  
  let content = script.content;
  
  // Replace each variable value in content
  for (const variable of newVariables) {
    const oldPattern = new RegExp(
      `(const\\s+${variable.name}\\s*=\\s*['"])([^'"]*)(["']\\s*;)`,
      'g'
    );
    content = content.replace(oldPattern, `$1${variable.value}$3`);
  }
  
  // Update script
  script.content = content;
  script.variables = newVariables;
  
  // Update runInIframes setting if provided
  if (runInIframes !== undefined) {
    script.runInIframes = runInIframes;
  }
  
  await chrome.storage.local.set({ userScripts: scripts });
  return { success: true };
}

// Get script by ID (including variables)
async function getScriptById(scriptId) {
  const scripts = await getScripts();
  return scripts.find(s => s.id === scriptId) || null;
}

// Update script
async function updateScript(scriptId) {
  const scripts = await getScripts();
  const script = scripts.find(s => s.id === scriptId);
  
  if (!script || !script.repoInfo) {
    return { success: false, error: 'Script not found or no source URL' };
  }
  
  try {
    // Fetch latest content
    const fetchResult = await fetchScriptContent(script.repoInfo);
    if (!fetchResult.success) {
      return { success: false, error: fetchResult.error };
    }
    
    let content = fetchResult.content;
    const metadata = parseScriptMetadata(content);
    
    // Preserve user-modified variable values
    const oldVariables = script.variables || [];
    const newVariables = metadata.variables || [];
    
    for (const newVar of newVariables) {
      const oldVar = oldVariables.find(v => v.name === newVar.name);
      if (oldVar) {
        newVar.value = oldVar.value;
      }
    }
    
    // Apply user variable values to content
    for (const variable of newVariables) {
      const oldPattern = new RegExp(
        `(const\\s+${variable.name}\\s*=\\s*['"])([^'"]*)(["']\\s*;)`,
        'g'
      );
      content = content.replace(oldPattern, `$1${variable.value}$3`);
    }
    
    // Update script
    script.content = content;
    script.version = metadata.version || script.version;
    script.variables = newVariables;
    script.lastUpdated = Date.now();
    script.hasUpdate = false;
    
    await chrome.storage.local.set({ userScripts: scripts });
    return { success: true };
  } catch (error) {
    console.error('[Background] Error updating script:', error);
    return { success: false, error: error.message };
  }
}

// Check for updates
async function checkForUpdates() {
  const scripts = await getScripts();
  let updatesFound = 0;
  
  for (const script of scripts) {
    if (!script.repoInfo) continue;
    
    const fetchResult = await fetchScriptContent(script.repoInfo);
    if (fetchResult.success) {
      const metadata = parseScriptMetadata(fetchResult.content);
      if (metadata.version !== script.version) {
        script.hasUpdate = true;
        updatesFound++;
      }
    }
  }
  
  await chrome.storage.local.set({ userScripts: scripts });
  return { success: true, updatesFound };
}

// Get scripts that match URL
async function getScriptsForUrl(url) {
  const scripts = await getScripts();
  return scripts.filter(script => {
    if (!script.enabled) return false;
    
    // Check matches
    for (const pattern of script.matches) {
      if (matchPattern(url, pattern)) return true;
    }
    
    return false;
  });
}

// Simple pattern matching
function matchPattern(url, pattern) {
  if (pattern === '*://*/*') return true;
  
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp('^' + regexPattern + '$');
  return regex.test(url);
}

// Inject scripts for tab
async function injectScriptsForTab(tabId, url) {
  const scripts = await getScriptsForUrl(url);
  
  if (scripts.length === 0) {
    return { success: true, count: 0 };
  }
  
  console.log(`[ScriptLoader] Injecting ${scripts.length} script(s) into tab ${tabId}`);
  
  for (const script of scripts) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        world: 'ISOLATED',
        func: (scriptContent, scriptName) => {
          // Try multiple methods to inject script, bypassing CSP
          function injectScript(content) {
            // Method 1: Blob URL (bypasses most CSP)
            try {
              const blob = new Blob([content], { type: 'application/javascript' });
              const blobUrl = URL.createObjectURL(blob);
              const scriptEl = document.createElement('script');
              scriptEl.src = blobUrl;
              scriptEl.onload = () => {
                URL.revokeObjectURL(blobUrl);
                console.log(`[ScriptLoader] ✅ Injected via Blob URL: ${scriptName}`);
              };
              scriptEl.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                console.warn(`[ScriptLoader] Blob URL failed, trying inline...`);
                injectInline(content);
              };
              (document.head || document.documentElement).appendChild(scriptEl);
              return;
            } catch (e) {
              console.warn('[ScriptLoader] Blob method failed:', e);
            }
            
            // Fallback to inline
            injectInline(content);
          }
          
          // Method 2: Inline script (for sites allowing unsafe-inline)
          function injectInline(content) {
            try {
              const scriptEl = document.createElement('script');
              scriptEl.textContent = content;
              (document.head || document.documentElement).appendChild(scriptEl);
              scriptEl.remove();
              console.log(`[ScriptLoader] ✅ Injected via inline: ${scriptName}`);
            } catch (e) {
              console.error('[ScriptLoader] ❌ All injection methods failed:', e);
            }
          }
          
          // Wait for DOM ready then inject
          function waitAndInject(content) {
            function tryInject() {
              if (document.head || document.documentElement) {
                injectScript(content);
              } else {
                setTimeout(tryInject, 100);
              }
            }
            
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', tryInject);
            } else {
              tryInject();
            }
          }
          
          waitAndInject(scriptContent);
        },
        args: [script.content, script.name]
      });
      
      console.log(`[ScriptLoader] Injected: ${script.name}`);
    } catch (error) {
      console.error(`[ScriptLoader] Failed to inject ${script.name}:`, error);
    }
  }
  
  return { success: true, count: scripts.length };
}

// Listen for tab updates - DISABLED: content.js now handles injection
// chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
//   if (changeInfo.status === 'complete' && tab.url) {
//     // Skip chrome:// and extension pages
//     if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
//       return;
//     }
//     
//     await injectScriptsForTab(tabId, tab.url);
//   }
// });

// Execute user script in tab using chrome.scripting API with MAIN world
async function executeUserScriptInTab(tabId, frameId, scriptContent, scriptName) {
  try {
    // Build target - if frameId is provided, inject only to that frame
    const target = frameId !== undefined && frameId !== null
      ? { tabId: tabId, frameIds: [frameId] }  // Specific frame only
      : { tabId: tabId, allFrames: true };     // All frames (fallback)
    
    const results = await chrome.scripting.executeScript({
      target: target,
      world: 'MAIN', // Execute in page context
      func: (code, name) => {
        // Wrapper để chờ DOM ready và retry
        function executeWithRetry(content, maxRetries = 5, delay = 500) {
          let retries = 0;
          
          function tryExecute() {
            try {
              // Check if DOM has meaningful content
              if (document.body && document.body.textContent.length > 100) {
                console.log('[ScriptLoader] DOM ready, executing script...');
                eval(content);
                console.log(`[ScriptLoader] ✅ Script executed: ${name}`);
                return true;
              } else if (retries < maxRetries) {
                retries++;
                console.log('[ScriptLoader] DOM not ready, retry', retries);
                setTimeout(tryExecute, delay);
                return null; // Still trying
              } else {
                // Force execute after max retries
                console.log('[ScriptLoader] Max retries reached, force executing...');
                eval(content);
                console.log(`[ScriptLoader] ✅ Script executed: ${name}`);
                return true;
              }
            } catch (error) {
              console.error(`[ScriptLoader] ❌ Script error: ${name}`, error);
              return false;
            }
          }
          
          // Start execution
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryExecute);
          } else {
            tryExecute();
          }
        }
        
        executeWithRetry(code);
        return { success: true }; // Return success since we started execution
      },
      args: [scriptContent, scriptName]
    });
    
    console.log(`[Background] Executed script: ${scriptName}`);
    return { success: true };
  } catch (error) {
    console.error(`[Background] Failed to execute script ${scriptName}:`, error);
    return { success: false, error: error.message };
  }
}

// Note: Default script is now added by popup.js when script list is empty