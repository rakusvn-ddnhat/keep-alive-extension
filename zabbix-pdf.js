// Zabbix PDF Generator Script
(function() {
  const statusEl = document.getElementById('status');
  const progressFill = document.getElementById('progressFill');
  const chartsPreview = document.getElementById('chartsPreview');
  const downloadPdfBtn = document.getElementById('downloadPdf');
  const closeTabBtn = document.getElementById('closeTab');
  
  let chartData = [];
  
  // Load charts from storage
  chrome.storage.local.get(['zabbixCharts'], (result) => {
    if (!result.zabbixCharts || result.zabbixCharts.length === 0) {
      statusEl.textContent = '❌ Không có dữ liệu charts';
      statusEl.className = 'status error';
      return;
    }
    
    chartData = result.zabbixCharts;
    
    // Show preview
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
    downloadPdfBtn.disabled = false;
    
    // Clear storage
    chrome.storage.local.remove('zabbixCharts');
  });
  
  // Download PDF
  downloadPdfBtn.addEventListener('click', async () => {
    if (chartData.length === 0) return;
    
    statusEl.innerHTML = '⏳ Đang tạo PDF...';
    statusEl.className = 'status loading';
    downloadPdfBtn.disabled = true;
    
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
      
      for (let i = 0; i < chartData.length; i++) {
        const chart = chartData[i];
        
        if (i > 0) pdf.addPage();
        
        // Title
        pdf.setFontSize(14);
        pdf.setTextColor(51, 51, 51);
        pdf.text(chart.name, 10, 12);
        
        // Add image
        try {
          // Calculate dimensions to fit page
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const maxWidth = pageWidth - 20; // margins
          
          pdf.addImage(chart.base64, 'PNG', 10, 18, maxWidth, 0);
        } catch (e) {
          pdf.setTextColor(255, 0, 0);
          pdf.text('Lỗi tải ảnh', 10, 50);
        }
        
        // Update progress
        progressFill.style.width = ((i + 1) / chartData.length * 100) + '%';
      }
      
      // Save
      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save('zabbix_charts_' + timestamp + '.pdf');
      
      statusEl.innerHTML = '✅ Đã xuất PDF với ' + chartData.length + ' charts!';
      statusEl.className = 'status success';
      downloadPdfBtn.disabled = false;
      
    } catch (error) {
      console.error('PDF Error:', error);
      statusEl.innerHTML = '❌ Lỗi: ' + error.message;
      statusEl.className = 'status error';
      downloadPdfBtn.disabled = false;
    }
  });
  
  // Close tab
  closeTabBtn.addEventListener('click', () => {
    window.close();
  });
})();
