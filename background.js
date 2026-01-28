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