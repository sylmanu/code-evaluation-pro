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
    this.exerciseGroups = {}; // Add for multi-exercise support

    this.initializeElements();
    this.bindEvents();
    this.initializeSettings(); // This now handles both model options and loading settings
  }

  // Consolidated and refined initializeSettings
  initializeSettings() {
    this.loadSettingsFromStorage(); // Load saved settings first
    this.updateModelOptions(); // Then update model options based on loaded provider
    this.updateSliderDisplays(); // And update slider displays
    this.updateApiKeyHint(); // Update API key hint based on loaded provider
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

    // New LLM settings elements
    this.customEndpointGroup = document.getElementById('customEndpointGroup'); // The div containing customEndpoint
    this.apiTestBtn = document.getElementById('apiTestBtn');
    this.apiTestStatus = document.getElementById('apiTestStatus');
    this.providerApiLink = document.getElementById('providerApiLink');

    this.temperatureSlider = document.getElementById('temperature');
    this.temperatureValueSpan = document.getElementById('temperatureValue');
    this.maxTokensSlider = document.getElementById('maxTokens');
    this.maxTokensValueSpan = document.getElementById('maxTokensValue');
    this.topPSlider = document.getElementById('topP');
    this.topPValueSpan = document.getElementById('topPValue');
    this.frequencyPenaltySlider = document.getElementById('frequencyPenalty');
    this.frequencyPenaltyValueSpan = document.getElementById('frequencyPenaltyValue');
    this.systemPromptTextarea = document.getElementById('systemPrompt');
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
    this.llmProvider.addEventListener('change', this.handleProviderChange.bind(this)); // Use a new handler for provider change
    this.keyVisibilityBtn.addEventListener('click', this.toggleKeyVisibility.bind(this));
    this.apiTestBtn.addEventListener('click', this.testApiKey.bind(this)); // New API test button event
    this.resetSettings.addEventListener('click', this.resetToDefaults.bind(this));
    this.saveSettings.addEventListener('click', this.saveSettingsToStorage.bind(this));

    // Slider input events
    this.temperatureSlider.addEventListener('input', () => this.temperatureValueSpan.textContent = this.temperatureSlider.value);
    this.maxTokensSlider.addEventListener('input', () => this.maxTokensValueSpan.textContent = this.maxTokensSlider.value);
    this.topPSlider.addEventListener('input', () => this.topPValueSpan.textContent = this.topPSlider.value);
    this.frequencyPenaltySlider.addEventListener('input', () => this.frequencyPenaltyValueSpan.textContent = this.frequencyPenaltySlider.value);

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsModal.classList.contains('active')) {
        this.closeSettingsModal();
      }
    });
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
    const sampleRows = this.csvData.slice(1, 6); // Show first 5 data rows

    // Detect unique exercises in the data
    const qNoIndex = headers.findIndex(h => h === 'Q.No');
    const exercises = new Set();

    for (let i = 1; i < Math.min(20, this.csvData.length); i++) {
      const qNo = this.csvData[i][qNoIndex];
      if (qNo) exercises.add(qNo);
    }

    let tableHtml = '<table class="csv-table"><thead><tr>';

    // Show relevant columns for preview
    const previewColumns = ['出席番号', '氏名', 'Q.No', 'report/answer', 'point', 'comment'];
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
          const truncated = cellContent.length > 60 ? cellContent.substring(0, 60) + '...' : cellContent;
          tableHtml += `<td title="${cellContent.replace(/"/g, '&quot;')}">${truncated}</td>`;
        }
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';

    if (this.csvData.length > 6) {
      const remainingRows = this.csvData.length - 6;
      const exerciseList = Array.from(exercises).join(', ');
      tableHtml += `<p style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.8rem;">
        ... and ${remainingRows} more rows<br>
        <strong>Detected exercises:</strong> ${exerciseList} (${exercises.size} different exercises)
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

    // Group data by exercises for better progress tracking
    this.exerciseGroups = this.groupByExercises();
    console.log('Exercise groups:', this.exerciseGroups);

    this.progressSection.classList.add('active');
    this.totalItems.textContent = this.csvData.length - 1; // Exclude header
    this.startTimer();

    this.evaluateBtn.disabled = true;
    this.pauseBtn.disabled = false;

    await this.processEvaluations();
  }

  groupByExercises() {
    const headers = this.originalHeaders;
    const qNoIndex = headers.findIndex(h => h === 'Q.No');
    const groups = {};

    // Group rows by Q.No (exercise number)
    for (let i = 1; i < this.csvData.length; i++) {
      const row = this.csvData[i];
      const exerciseNo = row[qNoIndex] || 'Unknown';

      if (!groups[exerciseNo]) {
        groups[exerciseNo] = [];
      }
      groups[exerciseNo].push({ rowIndex: i, data: row });
    }

    return groups;
  }

  async processEvaluations() {
    const exercises = Object.keys(this.exerciseGroups);
    console.log(`Processing ${exercises.length} exercises:`, exercises);

    // Show current exercise being processed
    for (const exerciseNo of exercises) {
      if (!this.isEvaluating) break;

      console.log(`\n=== Processing Exercise ${exerciseNo} ===`);
      const exerciseRows = this.exerciseGroups[exerciseNo];

      for (const { rowIndex, data } of exerciseRows) {
        if (!this.isEvaluating) break;

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

        try {
          this.currentIndex = rowIndex;
          await this.evaluateSingleSubmission(rowIndex, exerciseNo);
          this.updateProgress();
          this.updateResultsDisplay();
        } catch (error) {
          console.error(`Error evaluating exercise ${exerciseNo}, row ${rowIndex}:`, error);
          this.showToast(`Error evaluating exercise ${exerciseNo}: ${error.message}`, 'error');
        }
      }
    }

    if (this.isEvaluating) {
      this.completeEvaluation();
    }
  }

  async evaluateSingleSubmission(index, exerciseNo = null) {
    const row = this.csvData[index];
    const headers = this.originalHeaders;

    // Extract data from the new format
    const nameIndex = headers.findIndex(h => h === '氏名');
    const userIdIndex = headers.findIndex(h => h === 'USERID');
    const answerIndex = headers.findIndex(h => h === 'report/answer');
    const pointIndex = headers.findIndex(h => h === 'point');
    const commentIndex = headers.findIndex(h => h === 'comment');
    const qNoIndex = headers.findIndex(h => h === 'Q.No');

    const studentName = row[nameIndex] || `Student ${index}`;
    const userId = row[userIdIndex] || '';
    const code = row[answerIndex] || '';
    const currentExercise = exerciseNo || row[qNoIndex] || 'Unknown';

    // Create anonymous display ID - no personal info in logs or display
    const displayId = `Exercise ${currentExercise} - Submission ${index}`;

    // Skip if no code to evaluate
    if (!code.trim()) {
      this.results.push({
        id: displayId,
        exercise: currentExercise,
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

    // Create exercise-specific problem statement if available
    const exerciseSpecificProblem = this.createExerciseSpecificProblem(currentExercise);
    const problemToUse = exerciseSpecificProblem || this.problemStatement.value;

    // PRIVACY: Only send code and problem statement to LLM - NO student information
    const settings = this.getCurrentSettings();
    const response = await fetch('/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        problemStatement: problemToUse,
        userCode: code,  // Only the code, no student names, IDs, or other personal info
        llmSettings: settings, // Pass current LLM settings
        exerciseInfo: { // Add exercise context
          exerciseNumber: currentExercise,
          exerciseType: 'programming_exercise'
        }
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
      exercise: currentExercise,
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
    this.csvData[index][commentIndex] = this.formatComment(jsonData, result.score, currentExercise);
  }

  createExerciseSpecificProblem(exerciseNo) {
    // If user has entered different problem statements for different exercises,
    // they can be separated by "=== Exercise N ===" markers
    const mainProblem = this.problemStatement.value;

    if (!mainProblem.includes('===')) {
      // No exercise-specific problems, use the main one
      return mainProblem;
    }

    // Try to extract exercise-specific problem
    const exercisePattern = new RegExp(`===\\s*Exercise\\s*${exerciseNo}\\s*===([\\s\\S]*?)(?===\\s*Exercise\\s*\\d|$)`, 'i');
    const match = mainProblem.match(exercisePattern);

    if (match) {
      return match[1].trim();
    }

    // Fallback to main problem if specific one not found
    return mainProblem;
  }

  formatComment(jsonData, score, exerciseNo) {
    let comment = `Exercise ${exerciseNo} - Score: ${score}/5\n`;
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

    // Include exercise information in the display
    const exerciseInfo = result.exercise ? `<span class="exercise-badge">Ex ${result.exercise}</span>` : '';

    div.innerHTML = `
      <div class="result-header">
        <div class="result-id">${result.id} ${exerciseInfo}</div>
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

    // Count unique exercises
    const uniqueExercises = new Set(this.results.map(r => r.exercise)).size;

    document.getElementById('perfectCount').textContent = perfectCount;
    document.getElementById('passingCount').textContent = passingCount;
    document.getElementById('errorCount').textContent = errorCount;
    document.getElementById('finalAvgScore').textContent = avgScore;

    // Show exercise count in the interface
    console.log(`Evaluated ${this.results.length} submissions across ${uniqueExercises} exercises`);
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

  // --- Settings methods ---

  openSettingsModal() {
    this.settingsModal.classList.add('active'); // Add 'active' class to trigger CSS transition
    document.body.style.overflow = 'hidden'; // Prevent scrolling body when modal is open
    // The rest of the styling is now handled by CSS
  }

  closeSettingsModal() {
    this.settingsModal.classList.remove('active'); // Remove 'active' class to trigger CSS transition
    document.body.style.overflow = ''; // Restore body scrolling
  }

  handleModalClick(e) {
    // Only close if the click is directly on the modal overlay, not its content
    if (e.target === this.settingsModal) {
      this.closeSettingsModal();
    }
  }

  handleProviderChange() {
    this.updateModelOptions();
    this.updateApiKeyHint();
    // Show/hide custom endpoint based on provider selection
    if (this.llmProvider.value === 'custom') {
      this.customEndpointGroup.classList.remove('hidden');
    } else {
      this.customEndpointGroup.classList.add('hidden');
    }
  }

  updateModelOptions() {
    const provider = this.llmProvider.value;
    const modelSelect = this.llmModel;

    // Clear existing options
    modelSelect.innerHTML = '';

    const modelOptions = {
      openai: [
        { value: 'gpt-4o', text: 'GPT-4o (Recommended)' }, // Prioritize GPT-4o
        { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
        { value: 'gpt-4', text: 'GPT-4' },
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

    const models = modelOptions[provider] || [];
    models.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      modelSelect.appendChild(optionElement);
    });

    // Attempt to select the previously saved model if it exists
    // This is important after loading settings
    const currentModel = this.llmModel.dataset.currentValue; // Store original value in a data attribute
    if (currentModel && models.some(m => m.value === currentModel)) {
        this.llmModel.value = currentModel;
    } else if (models.length > 0) {
        this.llmModel.value = models[0].value; // Default to first available
    }
  }

  updateApiKeyHint() {
    const provider = this.llmProvider.value;
    switch (provider) {
      case 'openai':
        this.providerApiLink.href = 'https://platform.openai.com/account/api-keys';
        this.providerApiLink.textContent = 'Where to find my OpenAI API key?';
        break;
      case 'claude':
        this.providerApiLink.href = 'https://console.anthropic.com/settings/api-keys';
        this.providerApiLink.textContent = 'Where to find my Anthropic Claude API key?';
        break;
      case 'gemini':
        this.providerApiLink.href = 'https://aistudio.google.com/app/apikey';
        this.providerApiLink.textContent = 'Where to find my Google Gemini API key?';
        break;
      default:
        this.providerApiLink.href = '#';
        this.providerApiLink.textContent = 'Where to find my API key?';
    }
  }

  toggleKeyVisibility() {
    const input = this.apiKey;
    const icon = this.keyVisibilityBtn.querySelector('i');

    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }

  async testApiKey() {
    const apiKey = this.apiKey.value.trim();
    if (!apiKey) {
      this.showToast('Please enter an API key to test.', 'error');
      return;
    }

    const llmProvider = this.llmProvider.value;
    const customEndpoint = this.customEndpoint.value.trim();

    this.apiTestStatus.textContent = 'Testing...';
    this.apiTestStatus.style.color = 'orange';
    this.apiTestStatus.style.display = 'block'; // Show status

    try {
      // NOTE: In a production environment, this should ideally go through your backend
      // to avoid exposing API keys client-side. This is for client-side demonstration.
      let testUrl;
      let headers = {
        'Content-Type': 'application/json',
      };
      let body = {};

      switch (llmProvider) {
        case 'openai':
          testUrl = 'https://api.openai.com/v1/models'; // Low-cost endpoint to test auth
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'claude':
          testUrl = 'https://api.anthropic.com/v1/models';
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01'; // Required for Anthropic API
          break;
        case 'gemini':
          // Gemini's API typically requires project ID for model listing.
          // A simple text generation endpoint test is more practical.
          // This requires a dummy request.
          testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
          body = {
            contents: [{ parts: [{ text: "Hello" }] }]
          };
          break;
        case 'custom':
          // For custom, assume a simple GET request for now, or require a specific test endpoint
          // A more robust implementation would need user to define test endpoint/method
          testUrl = customEndpoint || ''; // User must provide a valid endpoint
          // For a custom endpoint, we can't reliably guess how to test it.
          // For a real app, you'd likely proxy this through your server
          // or have the user specify test parameters.
          if (!testUrl) throw new Error('Custom API Endpoint is required for testing.');
          break;
        default:
          throw new Error('Unsupported LLM Provider for API key test.');
      }

      const fetchOptions = {
        method: (llmProvider === 'gemini') ? 'POST' : 'GET',
        headers: headers,
        body: (llmProvider === 'gemini') ? JSON.stringify(body) : undefined
      };

      const response = await fetch(testUrl, fetchOptions);

      if (response.ok) {
        // For Gemini, check if response contains expected structure
        if (llmProvider === 'gemini') {
            const data = await response.json();
            if (data && data.candidates && data.candidates.length > 0) {
                this.apiTestStatus.textContent = 'API Key Valid!';
                this.apiTestStatus.style.color = 'green';
            } else {
                this.apiTestStatus.textContent = 'Invalid API Key (Gemini response issue).';
                this.apiTestStatus.style.color = 'red';
            }
        } else {
            this.apiTestStatus.textContent = 'API Key Valid!';
            this.apiTestStatus.style.color = 'green';
        }
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error ? (errorData.error.message || JSON.stringify(errorData.error)) : JSON.stringify(errorData);
        this.apiTestStatus.textContent = `Invalid API Key: ${errorMessage.substring(0, 50)}...`; // Truncate
        this.apiTestStatus.style.color = 'red';
      }
    } catch (error) {
      console.error('API Key Test Error:', error);
      this.apiTestStatus.textContent = `Error during test: ${error.message}`;
      this.apiTestStatus.style.color = 'red';
    } finally {
      setTimeout(() => {
        this.apiTestStatus.style.display = 'none'; // Hide status after a delay
      }, 5000);
    }
  }


  getCurrentSettings() {
    return {
      provider: this.llmProvider.value,
      model: this.llmModel.value,
      apiKey: this.apiKey.value, // API key is needed for evaluation
      customEndpoint: this.customEndpoint.value,
      temperature: parseFloat(this.temperatureSlider.value),
      maxTokens: parseInt(this.maxTokensSlider.value),
      topP: parseFloat(this.topPSlider.value),
      frequencyPenalty: parseFloat(this.frequencyPenaltySlider.value),
      systemPrompt: this.systemPromptTextarea.value,
    };
  }

  saveSettingsToStorage() {
    const settings = this.getCurrentSettings();

    // Do NOT save API key in localStorage for security reasons.
    // It should be entered by the user each session or managed via secure server-side methods.
    const settingsToSave = {
      provider: settings.provider,
      model: settings.model,
      customEndpoint: settings.customEndpoint,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      topP: settings.topP,
      frequencyPenalty: settings.frequencyPenalty,
      systemPrompt: settings.systemPrompt,
    };

    try {
      localStorage.setItem('llmSettings', JSON.stringify(settingsToSave));
      this.showToast('LLM settings saved successfully!', 'success');
      this.closeSettingsModal();
    } catch (error) {
      this.showToast('Error saving LLM settings', 'error');
      console.error('Error saving LLM settings:', error);
    }
  }

  loadSettingsFromStorage() {
    try {
      const savedSettings = localStorage.getItem('llmSettings');
      const defaultSettings = this.getDefaultSettings(); // Get defaults for merging

      let settingsToApply = defaultSettings;

      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Merge saved settings with defaults to ensure all fields are covered
        settingsToApply = { ...defaultSettings, ...parsedSettings };
      }

      this.llmProvider.value = settingsToApply.provider;
      this.llmModel.dataset.currentValue = settingsToApply.model; // Store to set after updateModelOptions
      this.customEndpoint.value = settingsToApply.customEndpoint;
      this.temperatureSlider.value = settingsToApply.temperature;
      this.maxTokensSlider.value = settingsToApply.maxTokens;
      this.topPSlider.value = settingsToApply.topP;
      this.frequencyPenaltySlider.value = settingsToApply.frequencyPenalty;
      this.systemPromptTextarea.value = settingsToApply.systemPrompt;

      // Manually trigger change/input events to update UI elements
      this.handleProviderChange(); // This will also call updateModelOptions
      this.updateSliderDisplays();
      this.updateApiKeyHint(); // Ensure hint is correct after loading provider
      this.toggleKeyVisibility(); // Ensure initial key visibility icon is correct if type is password
    } catch (error) {
      console.error('Error loading settings from local storage:', error);
      // Fallback to default settings if there's an error
      this.resetToDefaults();
    }
  }

  getDefaultSettings() {
    return {
      provider: 'openai',
      model: 'gpt-4o', // Default to GPT-4o
      customEndpoint: '',
      temperature: 0.7,
      maxTokens: 500,
      topP: 1.0,
      frequencyPenalty: 0.0,
      systemPrompt: 'あなたは非常に優秀で公平なコード評価者です。学生のプログラミング課題に対して、明確で簡潔かつ正確なフィードバックを提供してください。正確性、効率性、問題文への適合性に重点を置いてください。フィードバックを提供する際は、コンパイル状況、テストケースの結果、コード品質、および割り当てた点数の簡潔な理由を必ず明確に述べてください。会話的な修辞や挨拶は含めないでください。',
    };
  }

  resetToDefaults() {
    if (!confirm('Are you sure you want to reset all LLM settings to their default values?')) {
      return;
    }

    const defaultSettings = this.getDefaultSettings();

    this.llmProvider.value = defaultSettings.provider;
    this.llmModel.dataset.currentValue = defaultSettings.model;
    this.apiKey.value = ''; // API key is always cleared on reset
    this.customEndpoint.value = defaultSettings.customEndpoint;
    this.temperatureSlider.value = defaultSettings.temperature;
    this.maxTokensSlider.value = defaultSettings.maxTokens;
    this.topPSlider.value = defaultSettings.topP;
    this.frequencyPenaltySlider.value = defaultSettings.frequencyPenalty;
    this.systemPromptTextarea.value = defaultSettings.systemPrompt;

    // Trigger updates for UI
    this.handleProviderChange(); // Update models and custom endpoint visibility
    this.updateSliderDisplays(); // Update slider value text
    this.updateApiKeyHint(); // Update API key hint

    try {
      localStorage.removeItem('llmSettings');
      this.showToast('LLM settings reset to defaults', 'success');
    } catch (error) {
      this.showToast('Error resetting settings', 'error');
      console.error('Error resetting LLM settings:', error);
    }
  }

  // Helper to update all slider display values
  updateSliderDisplays() {
    this.temperatureValueSpan.textContent = this.temperatureSlider.value;
    this.maxTokensValueSpan.textContent = this.maxTokensSlider.value;
    this.topPValueSpan.textContent = this.topPSlider.value;
    this.frequencyPenaltyValueSpan.textContent = this.frequencyPenaltySlider.value;
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  new CodeEvaluator();
});


/*




===Exercise 2===
{0，1}からなる3行5列の行列において，0の個数を求めるにあたり，下記のプログラムの挿入位置に入るコードを答えなさい：

include <stdio.h>

int main() {
    int array[3][5] = { {1, 0, 0, 1, 1}, {0, 1, 1, 1, 0}, {1, 0, 0, 0, 1} };
    int result = 0;

  //挿入位置

    printf("0の個数は%dです\n", result);

    return 0;
 }

===Exercise 6===
以下は，入力された小文字からなる文字列において，小文字の'm'を見つけたら大文字の’M’に変換するプログラムのmain関数である．void m2M (char *str)　を実装しなさい．なお，関数m2M中において，文字列の要素は必ずポインタでアクセスすること

 #define _CRT_SECURE_NO_WARNINGS

#include <stdio.h>

//挿入位置

int main()
{
    char buf[128];

    printf("文字列（小文字）を入力してください\n");
    scanf("%s", buf);

    m2M(buf);

    printf("処理結果は%sです\n", buf);

    return 0;
}




Vectorは3次元ベクトルを表す構造体である。下記の問に答えて空欄を記述してプログラムを完成させよ。
ただし、下記の注意に従うこと。
double getLength(Vector v)はベクトルv(x,y,z)の長さを返す関数である。
ベクトルの長さ|v|を求める式は下記の通りである。
|v| = (x2 + y2 + z2)1/2

void Normalize(vector *v)はベクトルv(x,y,z)を単位ベクトルeに変換する。
単位ベクトルeの変換は下記の通りである。また、必ず本関数内でgetLength(Vector v)を呼び出すこと。
e = v / |v| = (x/|v|, y/|v|, z/|v|)


#include 	&lt;stdio.h&gt;
#include 	&lt;math.h&gt;

struct Vector {
    double x;
    double y;
    double z;
};

//挿入位置

int main() {
    Vector a = { 1.0, 1.0, 1.0 };
    printf(&quot;ベクトルaの長さ：%lf\n&quot;, getLength(a));
    Normalize(&a);
    printf(&quot;Normalize後のベクトルaの長さ：%lf\n&quot;, getLength(a));
}"
*/
