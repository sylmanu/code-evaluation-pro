class CodeEvaluator {
  constructor() {
    this.csvData = [];
    this.originalHeaders = [];
    this.headerRowIndex = -1;
    this.metadataRows = [];
    this.results = [];
    this.isEvaluating = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.startTime = null;
    this.timer = null;

    this.initializeElements();
    this.bindEvents();
    this.initializeSettings();
    this.ensureModalHidden();
  }

  ensureModalHidden() {
    // Force hide the modal immediately on page load
    if (this.settingsModal) {
      this.settingsModal.style.display = 'none !important';
      this.settingsModal.style.visibility = 'hidden';
      this.settingsModal.style.opacity = '0';
    }
  }

  initializeSettings() {
    // Initialize model options
    this.updateModelOptions();
    // Load saved settings
    this.loadSettingsFromStorage();
  }

  initializeSettings() {
    // Initialize model options
    this.updateModelOptions();
  }

  initializeElements() {
    this.problemStatement = document.getElementById('problemStatement');
    this.fileUpload = document.getElementById('fileUpload');
    this.codeFile = document.getElementById('codeFile');
    this.csvPreview = document.getElementById('csvPreview');
    this.previewContent = document.getElementById('previewContent');
    this.evaluateBtn = document.getElementById('evaluateBtn');
    this.progressSection = document.getElementById('progressSection');
    this.progressBar = document.getElementById('progressBar');
    this.currentItem = document.getElementById('currentItem');
    this.totalItems = document.getElementById('totalItems');
    this.avgScore = document.getElementById('avgScore');
    this.timeElapsed = document.getElementById('timeElapsed');
    this.pauseBtn = document.getElementById('pauseBtn');
    this.resultsGrid = document.getElementById('resultsGrid');
    this.filterSelect = document.getElementById('filterSelect');
    this.sortBtn = document.getElementById('sortBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.summaryStats = document.getElementById('summaryStats');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');

    // Settings elements
    this.settingsIconBtn = document.getElementById('settingsIconBtn');
    this.settingsModal = document.getElementById('settingsModal');
    this.settingsCloseBtn = document.getElementById('settingsCloseBtn');
    this.llmProvider = document.getElementById('llmProvider');
    this.llmModel = document.getElementById('llmModel');
    this.apiKey = document.getElementById('apiKey');
    this.customEndpoint = document.getElementById('customEndpoint');
    this.keyVisibilityBtn = document.getElementById('keyVisibilityBtn');
    this.resetSettings = document.getElementById('resetSettings');
    this.saveSettings = document.getElementById('saveSettings');
  }

  bindEvents() {
    // File upload events
    this.fileUpload.addEventListener('click', () => this.codeFile.click());
    this.fileUpload.addEventListener('dragover', this.handleDragOver.bind(this));
    this.fileUpload.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.fileUpload.addEventListener('drop', this.handleDrop.bind(this));
    this.codeFile.addEventListener('change', this.handleFileSelect.bind(this));

    // Control events
    this.evaluateBtn.addEventListener('click', this.startEvaluation.bind(this));
    this.pauseBtn.addEventListener('click', this.togglePause.bind(this));
    this.filterSelect.addEventListener('change', this.filterResults.bind(this));
    this.sortBtn.addEventListener('click', this.sortResults.bind(this));
    this.exportBtn.addEventListener('click', this.exportResults.bind(this));

    // Problem statement validation
    this.problemStatement.addEventListener('input', this.validateForm.bind(this));

    // Settings events
    this.settingsIconBtn.addEventListener('click', this.openSettingsModal.bind(this));
    this.settingsCloseBtn.addEventListener('click', this.closeSettingsModal.bind(this));
    this.settingsModal.addEventListener('click', this.handleModalClick.bind(this));
    this.llmProvider.addEventListener('change', this.updateModelOptions.bind(this));
    this.keyVisibilityBtn.addEventListener('click', this.toggleKeyVisibility.bind(this));
    this.resetSettings.addEventListener('click', this.resetToDefaults.bind(this));
    this.saveSettings.addEventListener('click', this.saveSettingsToStorage.bind(this));

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsModal.classList.contains('show')) {
        this.closeSettingsModal();
      }
    });

    // Load saved settings
    this.loadSettingsFromStorage();
  }

  handleDragOver(e) {
    e.preventDefault();
    this.fileUpload.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.fileUpload.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.fileUpload.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  async processFile(file) {
    if (!file.name.endsWith('.csv')) {
      this.showToast('Please select a CSV file.', 'error');
      return;
    }

    try {
      this.showLoading(true);
      await this.readCsvFile(file);
      this.displayFilePreview();
      this.fileUpload.classList.add('uploaded');

      // Calculate actual student submissions (total rows - header row)
      const studentCount = this.csvData.length - 1;
      this.fileUpload.innerHTML = `
        <div class="upload-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h4>File uploaded successfully!</h4>
        <p>${file.name} (${studentCount} submissions)</p>
      `;
      this.validateForm();
      this.showToast('File uploaded successfully!', 'success');
    } catch (error) {
      this.showToast('Error reading file: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  readCsvFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const lines = content.split('\n').map(line => line.replace(/\r$/, ''));

          // Find the header row (contains 'report/answer')
          this.headerRowIndex = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('report/answer')) {
              this.headerRowIndex = i;
              break;
            }
          }

          if (this.headerRowIndex === -1) {
            reject(new Error('Could not find header row with "report/answer" column.'));
            return;
          }

          // Store metadata rows (everything before header)
          this.metadataRows = lines.slice(0, this.headerRowIndex);

          // Parse the actual CSV data (header + data rows)
          const csvContent = lines.slice(this.headerRowIndex).join('\n');

          Papa.parse(csvContent, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data.length < 2) {
                reject(new Error('CSV file must contain at least a header and one data row.'));
                return;
              }

              this.originalHeaders = results.data[0];
              this.csvData = results.data;

              // Validate required columns
              const requiredColumns = ['report/answer', 'point', 'comment'];
              const missingColumns = requiredColumns.filter(col =>
                !this.originalHeaders.includes(col)
              );

              if (missingColumns.length > 0) {
                reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
                return;
              }

              resolve();
            },
            error: (error) => {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file, 'utf-8');
    });
  }

  displayFilePreview() {
    if (this.csvData.length === 0) return;

    const headers = this.originalHeaders;
    const sampleRows = this.csvData.slice(1, 4); // Show first 3 data rows

    let tableHtml = '<table class="csv-table"><thead><tr>';

    // Show only non-sensitive columns for preview
    const previewColumns = ['出席番号', 'Q.No', 'report/answer', 'point', 'comment'];
    previewColumns.forEach(col => {
      if (headers.includes(col)) {
        tableHtml += `<th>${col}</th>`;
      }
    });
    tableHtml += '</tr></thead><tbody>';

    sampleRows.forEach(row => {
      tableHtml += '<tr>';
      previewColumns.forEach(col => {
        const colIndex = headers.indexOf(col);
        if (colIndex !== -1) {
          const cellContent = row[colIndex] || '';
          // Truncate code content for preview
          const truncated = cellContent.length > 100 ? cellContent.substring(0, 100) + '...' : cellContent;
          tableHtml += `<td title="${cellContent.replace(/"/g, '&quot;')}">${truncated}</td>`;
        }
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';

    if (this.csvData.length > 4) {
      const remainingRows = this.csvData.length - 4; // 4 = header + 3 preview rows
      tableHtml += `<p style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.8rem;">
        ... and ${remainingRows} more rows (Personal information hidden for privacy)
      </p>`;
    }

    this.previewContent.innerHTML = tableHtml;
    this.csvPreview.classList.remove('hidden');
  }

  validateForm() {
    const hasFile = this.csvData.length > 0;
    const hasProblem = this.problemStatement.value.trim().length > 0;
    this.evaluateBtn.disabled = !(hasFile && hasProblem);
  }

  async startEvaluation() {
    if (this.isEvaluating) return;

    this.isEvaluating = true;
    this.isPaused = false;
    this.currentIndex = 1; // Skip header
    this.results = [];
    this.startTime = Date.now();

    this.progressSection.classList.add('active');
    this.totalItems.textContent = this.csvData.length - 1; // Exclude header
    this.startTimer();

    this.evaluateBtn.disabled = true;
    this.pauseBtn.disabled = false;

    await this.processEvaluations();
  }

  async processEvaluations() {
    while (this.currentIndex < this.csvData.length && this.isEvaluating) {
      if (this.isPaused) {
        await new Promise(resolve => {
          const checkPause = () => {
            if (!this.isPaused || !this.isEvaluating) {
              resolve();
            } else {
              setTimeout(checkPause, 100);
            }
          };
          checkPause();
        });
      }

      if (!this.isEvaluating) break;

      try {
        await this.evaluateSingleSubmission(this.currentIndex);
        this.updateProgress();
        this.updateResultsDisplay();
      } catch (error) {
        console.error('Evaluation error:', error);
        this.showToast(`Error evaluating submission ${this.currentIndex}: ${error.message}`, 'error');
      }

      this.currentIndex++;
    }

    if (this.isEvaluating) {
      this.completeEvaluation();
    }
  }

  async evaluateSingleSubmission(index) {
    const row = this.csvData[index];
    const headers = this.originalHeaders;

    // Extract data from the new format
    const nameIndex = headers.findIndex(h => h === '氏名');
    const userIdIndex = headers.findIndex(h => h === 'USERID');
    const answerIndex = headers.findIndex(h => h === 'report/answer');
    const pointIndex = headers.findIndex(h => h === 'point');
    const commentIndex = headers.findIndex(h => h === 'comment');

    const studentName = row[nameIndex] || `Student ${index}`;
    const userId = row[userIdIndex] || '';
    const code = row[answerIndex] || '';

    // Create anonymous display ID - no personal info in logs or display
    const displayId = `Submission ${index}`;

    // Skip if no code to evaluate
    if (!code.trim()) {
      this.results.push({
        id: displayId,
        code: code,
        score: 0,
        result: 'NO_CODE',
        compile: 'N/A',
        quality: 0,
        reason: 'No code submitted',
        errorMsg: '',
        rawResponse: 'No code to evaluate'
      });

      // Update the CSV row
      this.csvData[index][pointIndex] = 0;
      this.csvData[index][commentIndex] = 'No code submitted';
      return;
    }

    // PRIVACY: Only send code and problem statement to LLM - NO student information
    const settings = this.getCurrentSettings();
    const response = await fetch('/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        problemStatement: this.problemStatement.value,
        userCode: code,  // Only the code, no student names, IDs, or other personal info
        llmSettings: settings // Pass current LLM settings
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Evaluation failed');
    }

    const jsonData = JSON.parse(data.output);
    const result = this.calculateScore(jsonData);

    this.results.push({
      id: displayId,
      code: code,
      score: result.score,
      result: jsonData.Result,
      compile: jsonData.Compile,
      quality: jsonData.Quality,
      reason: jsonData.Reason,
      errorMsg: jsonData.Error_msg,
      rawResponse: data.output
    });

    // Update the CSV row with score and detailed comment
    // The original student info remains in the CSV, only score/comment are updated
    this.csvData[index][pointIndex] = result.score;
    this.csvData[index][commentIndex] = this.formatComment(jsonData, result.score);
  }

  formatComment(jsonData, score) {
    let comment = `Score: ${score}/5\n`;
    comment += `Result: ${jsonData.Result}\n`;
    comment += `Compilation: ${jsonData.Compile}\n`;
    comment += `Quality: ${jsonData.Quality}/5\n`;

    if (jsonData.Error_msg) {
      comment += `Error: ${jsonData.Error_msg}\n`;
    }

    comment += `Reason: ${jsonData.Reason}`;

    return comment;
  }

  calculateScore(jsonData) {
    const result = jsonData.Result;
    const compile = jsonData.Compile;
    const quality = parseInt(jsonData.Quality) || 1;

    let score = 0;
    if (result === 'PERFECT!') {
      score = Math.max(quality, 5);
    } else if (result === 'INCOMPLETE!' && compile === 'OK') {
      score = Math.floor(quality / 2) + 2;
    } else {
      score = Math.floor(quality / 2) + 1;
    }

    return { score };
  }

  updateProgress() {
    const progress = ((this.currentIndex) / (this.csvData.length - 1)) * 100;
    this.progressBar.style.width = `${progress}%`;
    this.currentItem.textContent = this.currentIndex;

    // Calculate average score
    if (this.results.length > 0) {
      const avgScore = this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length;
      this.avgScore.textContent = avgScore.toFixed(1);
    }
  }

  updateResultsDisplay() {
    this.resultsGrid.innerHTML = '';
    const filteredResults = this.getFilteredResults();

    if (filteredResults.length === 0) {
      this.resultsGrid.innerHTML = `
        <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No results match the current filter.
        </p>
      `;
      return;
    }

    filteredResults.forEach(result => {
      const resultElement = this.createResultElement(result);
      this.resultsGrid.appendChild(resultElement);
    });

    this.exportBtn.disabled = false;
  }

  createResultElement(result) {
    const div = document.createElement('div');
    div.className = 'result-item';

    const scoreClass = result.score >= 5 ? 'score-perfect' :
                      result.score >= 3 ? 'score-good' : 'score-poor';

    div.innerHTML = `
      <div class="result-header">
        <div class="result-id">${result.id}</div>
        <div class="score-badge ${scoreClass}">Score: ${result.score}</div>
      </div>
      <div class="result-details">
        <strong>Result:</strong> ${result.result} |
        <strong>Compile:</strong> ${result.compile} |
        <strong>Quality:</strong> ${result.quality}/5
        ${result.errorMsg ? `<br><strong>Error:</strong> ${result.errorMsg}` : ''}
        <br><strong>Reason:</strong> ${result.reason}
      </div>
    `;

    return div;
  }

  getFilteredResults() {
    const filter = this.filterSelect.value;

    switch (filter) {
      case 'perfect':
        return this.results.filter(r => r.score >= 5);
      case 'passing':
        return this.results.filter(r => r.score >= 3 && r.score < 5);
      case 'failing':
        return this.results.filter(r => r.score < 3);
      case 'errors':
        return this.results.filter(r => r.compile === 'ERROR');
      default:
        return this.results;
    }
  }

  filterResults() {
    this.updateResultsDisplay();
  }

  sortResults() {
    this.results.sort((a, b) => b.score - a.score);
    this.updateResultsDisplay();
  }

  startTimer() {
    this.timer = setInterval(() => {
      if (!this.isPaused && this.isEvaluating) {
        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        this.timeElapsed.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.pauseBtn.innerHTML = this.isPaused ?
      '<i class="fas fa-play"></i> Resume' :
      '<i class="fas fa-pause"></i> Pause';
  }

  completeEvaluation() {
    this.isEvaluating = false;
    clearInterval(this.timer);

    this.evaluateBtn.disabled = false;
    this.pauseBtn.disabled = true;
    this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';

    this.updateSummaryStats();
    this.summaryStats.classList.remove('hidden');

    this.showToast('Evaluation completed successfully!', 'success');
  }

  updateSummaryStats() {
    const perfectCount = this.results.filter(r => r.score >= 5).length;
    const passingCount = this.results.filter(r => r.score >= 3).length;
    const errorCount = this.results.filter(r => r.compile === 'ERROR').length;
    const avgScore = this.results.length > 0 ?
      (this.results.reduce((sum, r) => sum + r.score, 0) / this.results.length).toFixed(1) : 0;

    document.getElementById('perfectCount').textContent = perfectCount;
    document.getElementById('passingCount').textContent = passingCount;
    document.getElementById('errorCount').textContent = errorCount;
    document.getElementById('finalAvgScore').textContent = avgScore;
  }

  exportResults() {
    if (this.results.length === 0) {
      this.showToast('No results to export.', 'error');
      return;
    }

    // Reconstruct the complete file with metadata + updated CSV
    let completeContent = '';

    // Add metadata rows
    completeContent += this.metadataRows.join('\n') + '\n';

    // Add the updated CSV data
    completeContent += Papa.unparse(this.csvData);

    const blob = new Blob([completeContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluated_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Results exported successfully!', 'success');
  }

  showLoading(show) {
    this.loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  showToast(message, type = 'success') {
    this.toastMessage.textContent = message;
    this.toast.className = `toast ${type}`;
    this.toast.classList.add('show');

    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }

  // Settings methods
  openSettingsModal() {
    const modal = this.settingsModal;

    if (modal) {
      // Apply working styles (remove the red background, use proper dark theme)
      modal.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(15, 23, 42, 0.9) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 999999 !important;
        backdrop-filter: blur(4px) !important;
      `;

      document.body.style.overflow = 'hidden';

      // Ensure the modal content is also properly positioned
      const modalContent = modal.querySelector('.settings-modal-content');
      if (modalContent) {
        modalContent.style.cssText = `
          background: var(--surface) !important;
          border: 1px solid var(--border) !important;
          border-radius: 16px !important;
          width: 90% !important;
          max-width: 600px !important;
          max-height: 80vh !important;
          overflow: hidden !important;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5) !important;
          position: relative !important;
          z-index: 1000000 !important;
        `;
      }

      // Force style the close button directly
      const closeBtn = modal.querySelector('#settingsCloseBtn');
      if (closeBtn) {
        closeBtn.style.cssText = `
          position: absolute !important;
          top: 15px !important;
          right: 15px !important;
          background: none !important;
          border: none !important;
          color: #94a3b8 !important;
          font-size: 18px !important;
          cursor: pointer !important;
          padding: 8px !important;
          border-radius: 4px !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 999999999 !important;
        `;
        console.log('Close button styled:', closeBtn); // Debug log
      } else {
        console.error('Close button not found!');
      }

    } else {
      console.error('Settings modal element not found!');
    }
  }

  closeSettingsModal() {
    const modal = this.settingsModal;

    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  handleModalClick(e) {
    if (e.target === this.settingsModal) {
      this.closeSettingsModal();
    }
  }

  updateModelOptions() {
    const provider = this.llmProvider.value;
    const modelSelect = this.llmModel;

    // Clear existing options
    modelSelect.innerHTML = '';

    const modelOptions = {
      openai: [
        { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
        { value: 'gpt-4', text: 'GPT-4' },
        { value: 'gpt-4o', text: 'GPT-4o' },
        { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' }
      ],
      claude: [
        { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', text: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku' }
      ],
      gemini: [
        { value: 'gemini-pro', text: 'Gemini Pro' },
        { value: 'gemini-pro-vision', text: 'Gemini Pro Vision' }
      ],
      custom: [
        { value: 'custom-model', text: 'Custom Model' }
      ]
    };

    modelOptions[provider].forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      modelSelect.appendChild(optionElement);
    });
  }

  toggleKeyVisibility() {
    const input = this.apiKey;
    const icon = this.keyVisibilityBtn.querySelector('i');

    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  }

  getCurrentSettings() {
    return {
      provider: this.llmProvider.value,
      model: this.llmModel.value,
      apiKey: this.apiKey.value,
      customEndpoint: this.customEndpoint.value
    };
  }

  saveSettingsToStorage() {
    const settings = this.getCurrentSettings();

    // Don't save API key for security (user will need to enter it each session)
    const settingsToSave = { ...settings };
    delete settingsToSave.apiKey;

    try {
      localStorage.setItem('llmSettings', JSON.stringify(settingsToSave));
      this.showToast('Settings saved successfully!', 'success');
      this.closeSettingsModal();
    } catch (error) {
      this.showToast('Error saving settings', 'error');
    }
  }

  loadSettingsFromStorage() {
    try {
      const savedSettings = localStorage.getItem('llmSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        if (settings.provider) {
          this.llmProvider.value = settings.provider;
          this.updateModelOptions();
        }
        if (settings.model) {
          this.llmModel.value = settings.model;
        }
        if (settings.customEndpoint) {
          this.customEndpoint.value = settings.customEndpoint;
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  resetToDefaults() {
    this.llmProvider.value = 'openai';
    this.updateModelOptions();
    this.llmModel.value = 'gpt-4-turbo';
    this.apiKey.value = '';
    this.customEndpoint.value = '';

    try {
      localStorage.removeItem('llmSettings');
      this.showToast('Settings reset to defaults', 'success');
    } catch (error) {
      this.showToast('Error resetting settings', 'error');
    }
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  new CodeEvaluator();
});
