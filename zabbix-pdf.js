// Zabbix PDF Generator Script
(function() {
  const statusEl = document.getElementById('status');
  const progressFill = document.getElementById('progressFill');
  const chartsPreview = document.getElementById('chartsPreview');
  const downloadPdfBtn = document.getElementById('downloadPdf');
  const closeTabBtn = document.getElementById('closeTab');
  
  const isAutoDownload = new URLSearchParams(window.location.search).get('autoDownload') === '1';
  
  let chartData = [];
  
  // Hàm tạo và tải PDF
  async function generateAndDownloadPdf() {
    if (chartData.length === 0) return;
    
    statusEl.innerHTML = '⏳ Đang tạo PDF...';
    statusEl.className = 'status loading';
    if (downloadPdfBtn) downloadPdfBtn.disabled = true;
    
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('l', 'mm', 'a4');
      
      for (let i = 0; i < chartData.length; i++) {
        const chart = chartData[i];
        if (i > 0) pdf.addPage();
        pdf.setFontSize(14);
        pdf.setTextColor(51, 51, 51);
        pdf.text(chart.name, 10, 12);
        try {
          const pageWidth = pdf.internal.pageSize.getWidth();
          const maxWidth = pageWidth - 20;
          pdf.addImage(chart.base64, 'PNG', 10, 18, maxWidth, 0);
        } catch (e) {
          pdf.setTextColor(255, 0, 0);
          pdf.text('Lỗi tải ảnh: ' + chart.name, 10, 50);
        }
        progressFill.style.width = ((i + 1) / chartData.length * 100) + '%';
      }
      
      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save('zabbix_charts_' + timestamp + '.pdf');
      
      statusEl.innerHTML = '✅ Đã xuất PDF với ' + chartData.length + ' charts!';
      statusEl.className = 'status success';
      if (downloadPdfBtn) downloadPdfBtn.disabled = false;
      
      // Nếu chế độ tự động: đóng tab sau 1.5 giây
      if (isAutoDownload) {
        setTimeout(() => window.close(), 1500);
      }
    } catch (error) {
      console.error('PDF Error:', error);
      statusEl.innerHTML = '❌ Lỗi: ' + error.message;
      statusEl.className = 'status error';
      if (downloadPdfBtn) downloadPdfBtn.disabled = false;
    }
  }
  
  // Load charts from storage
  chrome.storage.local.get(['zabbixCharts'], (result) => {
    if (!result.zabbixCharts || result.zabbixCharts.length === 0) {
      statusEl.textContent = '❌ Không có dữ liệu charts';
      statusEl.className = 'status error';
      return;
    }
    
    chartData = result.zabbixCharts;
    
    // Clear storage
    chrome.storage.local.remove('zabbixCharts');
    
    if (isAutoDownload) {
      // Ẩn preview, chỉ hiện progress, tự động xuất PDF luôn
      if (chartsPreview) chartsPreview.style.display = 'none';
      if (downloadPdfBtn) downloadPdfBtn.style.display = 'none';
      statusEl.innerHTML = '⏳ Đang thu thập ' + chartData.length + ' charts, tự động xuất PDF...';
      statusEl.className = 'status loading';
      progressFill.style.width = '30%';
      // Chờ jsPDF load xong rồi chạy
      setTimeout(generateAndDownloadPdf, 300);
    } else {
      // Chế độ thủ công: hiện preview như cũ
      chartsPreview.innerHTML = chartData.map((chart, i) => {
        const div = document.createElement('div');
        div.className = 'chart-item';
        const img = document.createElement('img');
        img.src = chart.base64;
        img.alt = chart.name;
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = chart.name;
        div.appendChild(img);
        div.appendChild(nameDiv);
        return div.outerHTML;
      }).join('');
      
      statusEl.innerHTML = '✅ Đã tải ' + chartData.length + ' charts. Sẵn sàng xuất PDF!';
      statusEl.className = 'status success';
      progressFill.style.width = '100%';
      if (downloadPdfBtn) downloadPdfBtn.disabled = false;
    }
  });
  
  // Nút Download PDF thủ công
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', generateAndDownloadPdf);
  }
  
  // Close tab
  if (closeTabBtn) {
    closeTabBtn.addEventListener('click', () => window.close());
  }
})();
