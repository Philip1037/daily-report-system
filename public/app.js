// ==================== STATE MANAGEMENT ====================
let currentUser = null;
let departments = [];
let allReports = [];
let myReports = [];
let activeLoginRole = 'worker'; // 'worker' or 'management'
let selectedFiles = [];
let users = [];
let quill = null;
let activeAnalyticsPeriod = '7d';
let activeAnalyticsDept = '';
let chartTrend = null;
let chartDept = null;
let chartWeekly = null;

// ==================== DOM ELEMENTS ====================
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginErrorText = document.getElementById('login-error-text');

// Tabs
const tabWorker = document.getElementById('tab-worker');
const tabManagement = document.getElementById('tab-management');

// Navs
const navWorkerGroup = document.getElementById('nav-worker-group');
const navManagementGroup = document.getElementById('nav-management-group');
const navSubmitReport = document.getElementById('nav-submit-report');
const navWorkerHistory = document.getElementById('nav-worker-history');
const navAllReports = document.getElementById('nav-all-reports');
const navManageDepts = document.getElementById('nav-manage-depts');

// User details
const userAvatar = document.getElementById('user-avatar');
const userDisplayName = document.getElementById('user-display-name');
const userDisplayRole = document.getElementById('user-display-role');
const btnLogout = document.getElementById('btn-logout');

// View Headers
const viewTitle = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');
const headerDate = document.getElementById('header-date');

// Sections
const sectionSubmitReport = document.getElementById('view-submit-report-section');
const sectionWorkerHistory = document.getElementById('view-worker-history-section');
const sectionAllReports = document.getElementById('view-all-reports-section');
const sectionManageDepts = document.getElementById('view-manage-depts-section');
const sectionManageUsers = document.getElementById('view-manage-users-section');
const sectionAnalytics = document.getElementById('view-analytics-section');
const navManageUsers = document.getElementById('nav-manage-users');
const navAnalytics = document.getElementById('nav-analytics');

// Dropzone & File preview
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('reportImage');
const dropzonePrompt = document.querySelector('.dropzone-prompt');
// Dropzone elements handled dynamically via preview grid

// Forms
const reportForm = document.getElementById('report-form');
const addDeptForm = document.getElementById('add-dept-form');
const createWorkerForm = document.getElementById('create-worker-form');
const updateAdminForm = document.getElementById('update-admin-form');
const editWorkerForm = document.getElementById('edit-worker-form');

// Modals
const imageModal = document.getElementById('image-modal');
const modalZoomedImage = document.getElementById('modal-zoomed-image');
const modalCaption = document.getElementById('modal-caption');
const btnCloseModal = document.getElementById('btn-close-modal');
const userEditModal = document.getElementById('user-edit-modal');
const btnCloseUserModal = document.getElementById('btn-close-user-modal');

// ==================== APP INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Set date in header
  updateHeaderDate();
  
  // Setup Lucide icons
  lucide.createIcons();

  // Initialize Quill Editor if container is present
  if (document.getElementById('reportContent')) {
    quill = new Quill('#reportContent', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          [{ 'align': [] }],
          ['clean']
        ]
      },
      placeholder: "Describe the work you completed today, any challenges encountered, and goals for tomorrow..."
    });
  }

  // Check Session
  checkSession();

  // Bind Events
  setupEventListeners();
});

function updateHeaderDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  headerDate.textContent = new Date().toLocaleDateString('en-US', options);
}

// ==================== EVENTS SETUP ====================
function setupEventListeners() {
  // Login Tabs
  tabWorker.addEventListener('click', () => switchLoginTab('worker'));
  tabManagement.addEventListener('click', () => switchLoginTab('management'));

  // Password visibility helper
  function setupPasswordToggle(btnId, inputId, iconId) {
    const toggleBtn = document.getElementById(btnId);
    const inputField = document.getElementById(inputId);
    const eyeIcon = document.getElementById(iconId);
    if (toggleBtn && inputField && eyeIcon) {
      toggleBtn.addEventListener('click', () => {
        const isPassword = inputField.type === 'password';
        inputField.type = isPassword ? 'text' : 'password';
        eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        lucide.createIcons();
      });
    }
  }

  // Setup password toggles
  setupPasswordToggle('toggle-password', 'password', 'password-eye-icon');
  setupPasswordToggle('toggle-admin-password', 'admin-password', 'admin-password-eye-icon');
  setupPasswordToggle('toggle-worker-password', 'worker-password', 'worker-password-eye-icon');
  setupPasswordToggle('toggle-edit-worker-password', 'edit-worker-password', 'edit-worker-password-eye-icon');

  // Login Form Submission
  loginForm.addEventListener('submit', handleLogin);

  // Logout
  btnLogout.addEventListener('click', handleLogout);

  // Navigation Sidebar
  navSubmitReport.addEventListener('click', () => switchView('submit-report'));
  navWorkerHistory.addEventListener('click', () => switchView('worker-history'));
  navAllReports.addEventListener('click', () => switchView('all-reports'));
  navAnalytics.addEventListener('click', () => switchView('analytics'));
  navManageDepts.addEventListener('click', () => switchView('manage-depts'));
  navManageUsers.addEventListener('click', () => switchView('manage-users'));

  // Analytics Filter Events
  const btnAnalytics7d = document.getElementById('btn-analytics-7d');
  const btnAnalytics30d = document.getElementById('btn-analytics-30d');
  const btnAnalyticsAll = document.getElementById('btn-analytics-all');
  const selectAnalyticsDept = document.getElementById('analytics-dept-filter');

  if (btnAnalytics7d && btnAnalytics30d && btnAnalyticsAll && selectAnalyticsDept) {
    btnAnalytics7d.addEventListener('click', () => changeAnalyticsPeriod('7d'));
    btnAnalytics30d.addEventListener('click', () => changeAnalyticsPeriod('30d'));
    btnAnalyticsAll.addEventListener('click', () => changeAnalyticsPeriod('all'));
    selectAnalyticsDept.addEventListener('change', (e) => {
      activeAnalyticsDept = e.target.value;
      loadAnalyticsDashboard();
    });
  }

  // Worker Dropzone drag-and-drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleImagesSelection(files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImagesSelection(e.target.files);
    }
  });

  // Worker Report Form Submit
  reportForm.addEventListener('submit', handleReportSubmit);

  // Admin Add Department Form Submit
  addDeptForm.addEventListener('submit', handleAddDeptSubmit);

  // Admin User management events
  createWorkerForm.addEventListener('submit', handleCreateWorkerSubmit);
  updateAdminForm.addEventListener('submit', handleUpdateAdminSubmit);
  editWorkerForm.addEventListener('submit', handleEditWorkerSubmit);

  // Filters for management page
  document.getElementById('search-filter').addEventListener('input', applyFilters);
  document.getElementById('dept-filter').addEventListener('change', applyFilters);
  document.getElementById('date-filter').addEventListener('change', applyFilters);
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);

  // Zoom Modal close
  btnCloseModal.addEventListener('click', () => {
    imageModal.style.display = 'none';
  });
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      imageModal.style.display = 'none';
    }
  });

  // User Edit Modal close
  btnCloseUserModal.addEventListener('click', () => {
    userEditModal.style.display = 'none';
  });
  userEditModal.addEventListener('click', (e) => {
    if (e.target === userEditModal) {
      userEditModal.style.display = 'none';
    }
  });
}

// ==================== AUTHENTICATION FLOWS ====================
function switchLoginTab(role) {
  activeLoginRole = role;
  tabWorker.classList.toggle('active', role === 'worker');
  tabManagement.classList.toggle('active', role === 'management');
  
  const usernameInput = document.getElementById('username');
  if (role === 'worker') {
    usernameInput.placeholder = 'e.g. innovativesl';
  } else {
    usernameInput.placeholder = 'e.g. admin';
  }
  
  loginError.classList.add('hidden');
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.loggedIn) {
      currentUser = data.user;
      showAuthenticatedApp();
    } else {
      showLoginForm();
    }
  } catch (error) {
    console.error('Session check failed:', error);
    showLoginForm();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('btn-login-submit');

  loginError.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<span>Signing In...</span> <div class="status-pulse"></div>';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      currentUser = data.user;
      showAuthenticatedApp();
    } else {
      loginErrorText.textContent = data.error || 'Login failed.';
      loginError.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Login error:', error);
    loginErrorText.textContent = 'Server communication error. Please try again.';
    loginError.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Sign In</span> <i data-lucide="arrow-right"></i>';
    lucide.createIcons();
  }
}

async function handleLogout() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      currentUser = null;
      showLoginForm();
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ==================== LAYOUT TRANSITIONS ====================
function showLoginForm() {
  appContainer.classList.add('hidden');
  loginContainer.classList.remove('hidden');
  loginForm.reset();
}

function showAuthenticatedApp() {
  loginContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');
  
  // Set User Badge info
  userDisplayName.textContent = currentUser.username;
  userDisplayRole.textContent = currentUser.role === 'management' ? 'Management' : 'Worker';
  userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();

  // Load common data
  loadDepartments();

  // Configure Sidebar based on role
  if (currentUser.role === 'management') {
    navWorkerGroup.classList.add('hidden');
    navManagementGroup.classList.remove('hidden');
    switchView('all-reports');
  } else {
    navWorkerGroup.classList.remove('hidden');
    navManagementGroup.classList.add('hidden');
    switchView('submit-report');
    checkSubmissionStatusToday();
  }
}

function switchView(viewName) {
  // Hide all sections
  sectionSubmitReport.classList.add('hidden');
  sectionWorkerHistory.classList.add('hidden');
  sectionAllReports.classList.add('hidden');
  sectionManageDepts.classList.add('hidden');
  sectionManageUsers.classList.add('hidden');
  sectionAnalytics.classList.add('hidden');

  // Remove active sidebar state
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  if (viewName === 'submit-report') {
    sectionSubmitReport.classList.remove('hidden');
    navSubmitReport.classList.add('active');
    viewTitle.textContent = 'Submit Daily Report';
    viewSubtitle.textContent = 'Fill out your daily tasks accomplished';
    reportForm.reset();
    resetFileSelection();
    if (quill) {
      quill.setContents([]);
    }
  } 
  else if (viewName === 'worker-history') {
    sectionWorkerHistory.classList.remove('hidden');
    navWorkerHistory.classList.add('active');
    viewTitle.textContent = 'Submission History';
    viewSubtitle.textContent = 'Review your past accomplishments';
    loadWorkerHistory();
  } 
  else if (viewName === 'all-reports') {
    sectionAllReports.classList.remove('hidden');
    navAllReports.classList.add('active');
    viewTitle.textContent = 'Daily Reports Feed';
    viewSubtitle.textContent = 'Review and filter employee reports';
    loadManagementDashboard();
  } 
  else if (viewName === 'manage-depts') {
    sectionManageDepts.classList.remove('hidden');
    navManageDepts.classList.add('active');
    viewTitle.textContent = 'Manage Departments';
    viewSubtitle.textContent = 'Configure list of active company departments';
    loadDepartmentsTable();
  }
  else if (viewName === 'manage-users') {
    sectionManageUsers.classList.remove('hidden');
    navManageUsers.classList.add('active');
    viewTitle.textContent = 'Manage Accounts';
    viewSubtitle.textContent = 'Configure worker credentials and admin settings';
    loadUsersTable();
  }
  else if (viewName === 'analytics') {
    sectionAnalytics.classList.remove('hidden');
    navAnalytics.classList.add('active');
    viewTitle.textContent = 'Dashboard Analytics';
    viewSubtitle.textContent = 'Visualized reporting insights and trends';
    loadAnalyticsDashboard();
  }

  lucide.createIcons();
}

// ==================== DEPARTMENTS UTILITIES ====================
async function loadDepartments() {
  try {
    const res = await fetch('/api/departments');
    departments = await res.json();
    populateDepartmentDropdowns();
  } catch (error) {
    console.error('Error fetching departments:', error);
  }
}

function populateDepartmentDropdowns() {
  const selectNode = document.getElementById('department');
  const filterNode = document.getElementById('dept-filter');
  const analyticsFilterNode = document.getElementById('analytics-dept-filter');
  
  // Fill report submission select
  selectNode.innerHTML = '<option value="" disabled selected>Select Department</option>';
  departments.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    selectNode.appendChild(option);
  });

  // Fill filter dropdown (if management)
  if (filterNode) {
    filterNode.innerHTML = '<option value="">All Departments</option>';
    departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = dept;
      filterNode.appendChild(option);
    });
  }

  // Fill analytics filter dropdown
  if (analyticsFilterNode) {
    analyticsFilterNode.innerHTML = '<option value="">All Departments</option>';
    departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = dept;
      analyticsFilterNode.appendChild(option);
    });
  }
}

// ==================== IMAGE DROPZONE HANDLING ====================
function handleImagesSelection(files) {
  const newFiles = Array.from(files);
  
  // Validate file types and sizes
  for (const file of newFiles) {
    if (!file.type.startsWith('image/')) {
      alert(`File "${file.name}" is not an image (PNG, JPG, JPEG, GIF, WEBP).`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(`File "${file.name}" exceeds 5MB size limit.`);
      return;
    }
  }

  // Check limit (max 5)
  if (selectedFiles.length + newFiles.length > 5) {
    alert('You can upload a maximum of 5 images.');
    return;
  }

  selectedFiles = selectedFiles.concat(newFiles);
  renderPreviewGrid();
}

function renderPreviewGrid() {
  const previewGrid = document.getElementById('preview-grid');
  const dropzonePromptBox = document.getElementById('dropzone-prompt-box');
  
  if (selectedFiles.length === 0) {
    previewGrid.innerHTML = '';
    previewGrid.classList.add('hidden');
    dropzonePromptBox.classList.remove('hidden');
    return;
  }

  dropzonePromptBox.classList.add('hidden');
  previewGrid.classList.remove('hidden');
  previewGrid.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'preview-card';
    
    const img = document.createElement('img');
    img.alt = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'preview-card-name';
    nameSpan.textContent = file.name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-file-btn';
    removeBtn.innerHTML = '<i data-lucide="x"></i>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSelectedFile(index);
    });

    card.appendChild(img);
    card.appendChild(nameSpan);
    card.appendChild(removeBtn);
    previewGrid.appendChild(card);
  });

  lucide.createIcons();
}

function removeSelectedFile(index) {
  selectedFiles.splice(index, 1);
  renderPreviewGrid();
}

function resetFileSelection() {
  selectedFiles = [];
  fileInput.value = '';
  renderPreviewGrid();
}

// ==================== WORKER: REPORT SUBMISSION ====================
async function handleReportSubmit(e) {
  e.preventDefault();
  
  const employeeName = document.getElementById('employeeName').value.trim();
  const department = document.getElementById('department').value;
  const content = quill ? quill.root.innerHTML.trim() : '';
  const textContent = quill ? quill.getText().trim() : '';
  
  const errBanner = document.getElementById('submit-error');
  const errText = document.getElementById('submit-error-text');
  const successBanner = document.getElementById('submit-success');
  const btn = document.getElementById('btn-report-submit');

  errBanner.classList.add('hidden');
  successBanner.classList.add('hidden');

  if (textContent === '') {
    errText.textContent = 'Report content is required.';
    errBanner.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Submitting Report...</span> <div class="status-pulse"></div>';

  const formData = new FormData();
  formData.append('employeeName', employeeName);
  formData.append('department', department);
  formData.append('content', content);
  selectedFiles.forEach(file => {
    formData.append('reportImages', file);
  });

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (res.ok) {
      successBanner.classList.remove('hidden');
      reportForm.reset();
      resetFileSelection();
      if (quill) {
        quill.setContents([]);
      }
      
      // Update submission status dot
      checkSubmissionStatusToday();
      
      // Auto-hide success message after 5s
      setTimeout(() => successBanner.classList.add('hidden'), 5000);
    } else {
      errText.textContent = data.error || 'Failed to submit report.';
      errBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Submit report error:', error);
    errText.textContent = 'Server communication error. Please try again.';
    errBanner.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Submit Daily Report</span> <i data-lucide="send"></i>';
    lucide.createIcons();
  }
}

async function checkSubmissionStatusToday() {
  try {
    const res = await fetch('/api/reports/my-reports');
    const myReports = await res.json();
    
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    const todayStr = new Date().toDateString();
    const submittedToday = myReports.some(report => {
      return new Date(report.createdAt).toDateString() === todayStr;
    });

    if (submittedToday) {
      statusDot.className = 'status-pulse submitted';
      statusText.textContent = 'Submitted today';
    } else {
      statusDot.className = 'status-pulse not-submitted';
      statusText.textContent = 'Not submitted today';
    }
  } catch (error) {
    console.error('Error checking submission status:', error);
  }
}

// ==================== WORKER: REPORTS HISTORY ====================
async function loadWorkerHistory() {
  const grid = document.getElementById('worker-reports-list');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><p class="text-muted">Loading reports...</p></div>';

  try {
    const res = await fetch('/api/reports/my-reports');
    myReports = await res.json();
    
    if (myReports.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1;" class="card glass no-reports">
          <i data-lucide="file-warning" class="no-reports-icon"></i>
          <h3>No reports submitted yet</h3>
          <p class="text-muted">Your daily submissions will be displayed here.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    grid.innerHTML = '';
    myReports.forEach(report => {
      const card = document.createElement('div');
      card.className = 'card glass report-card';
      
      const imageTag = renderReportImages(report.imagePath, `Submitted by ${report.employeeName}`);

      const formattedDate = new Date(report.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div class="report-header">
          <div class="report-author">
            <h4>${escapeHtml(report.employeeName)}</h4>
            <span>${escapeHtml(report.department)}</span>
          </div>
          <div class="report-date">${escapeHtml(formattedDate)}</div>
        </div>
        <div class="report-content ql-editor" style="padding: 0; min-height: auto;">${report.content}</div>
        ${imageTag}
        <div class="report-actions" style="margin-top: 1rem; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-glass); padding-top: 0.75rem;">
          <a href="/api/reports/${report.id}/docx" class="table-btn edit-btn" style="text-decoration: none;" title="Download Word Document">
            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Word
          </a>
          <a href="/api/reports/${report.id}/pdf" class="table-btn edit-btn" style="text-decoration: none; margin-left: 8px;" title="Download PDF Document">
            <i data-lucide="file-down" style="width: 14px; height: 14px;"></i> PDF
          </a>
          <button class="table-btn delete-btn" style="margin-left: auto;" onclick="deleteWorkReport('${report.id}')">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete
          </button>
        </div>
      `;
      grid.appendChild(card);
      applyReadMoreToggle(card);
    });
  } catch (error) {
    console.error('Error loading worker reports history:', error);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><p class="error-text">Failed to load history.</p></div>';
  }
}

// ==================== MANAGEMENT: ALL REPORTS FEED ====================
async function loadManagementDashboard() {
  try {
    const res = await fetch('/api/reports/all');
    allReports = await res.json();
    
    // Update stats metrics
    calculateStats();
    
    // Render reports feed with active filters
    applyFilters();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

function calculateStats() {
  const totalReportsNode = document.getElementById('stats-total-reports');
  const activeDeptsNode = document.getElementById('stats-active-depts');
  const todayReportsNode = document.getElementById('stats-today-reports');

  totalReportsNode.textContent = allReports.length;

  // Compute active departments (departments that have submitted at least 1 report)
  const uniqueDepts = new Set(allReports.map(r => r.department));
  activeDeptsNode.textContent = uniqueDepts.size;

  // Compute reports submitted today
  const todayStr = new Date().toDateString();
  const reportsToday = allReports.filter(r => new Date(r.createdAt).toDateString() === todayStr);
  todayReportsNode.textContent = reportsToday.length;
}

function applyFilters() {
  const searchQuery = document.getElementById('search-filter').value.toLowerCase().trim();
  const selectedDept = document.getElementById('dept-filter').value;
  const selectedDate = document.getElementById('date-filter').value;

  // Filter reports
  const filtered = allReports.filter(report => {
    // Search filter
    const matchesSearch = !searchQuery || 
      report.employeeName.toLowerCase().includes(searchQuery) ||
      report.content.toLowerCase().includes(searchQuery);

    // Department filter
    const matchesDept = !selectedDept || report.department === selectedDept;

    // Date filter
    let matchesDate = true;
    if (selectedDate) {
      const reportDateStr = new Date(report.createdAt).toISOString().split('T')[0];
      matchesDate = reportDateStr === selectedDate;
    }

    return matchesSearch && matchesDept && matchesDate;
  });

  renderGroupedReports(filtered);
}

function clearFilters() {
  document.getElementById('search-filter').value = '';
  document.getElementById('dept-filter').value = '';
  document.getElementById('date-filter').value = '';
  applyFilters();
}

function renderGroupedReports(reports) {
  const container = document.getElementById('management-reports-container');
  
  if (reports.length === 0) {
    container.innerHTML = `
      <div class="card glass no-reports">
        <i data-lucide="search-slash" class="no-reports-icon"></i>
        <h3>No matching reports found</h3>
        <p class="text-muted">Adjust your search or filter inputs to see results.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Group by department
  const grouped = {};
  
  // Initialize groupings with all departments to keep headers consistent, 
  // or only show departments that have actual reports in the current filter.
  // Let's only display departments that have matching reports to keep screen clean.
  reports.forEach(report => {
    if (!grouped[report.department]) {
      grouped[report.department] = [];
    }
    grouped[report.department].push(report);
  });

  container.innerHTML = '';
  
  // Department color indices for nice styling variety
  const badgeColors = ['badge-blue', 'badge-emerald', 'badge-amber', 'badge-rose', 'badge-purple', 'badge-cyan', 'badge-gray'];
  let colorIdx = 0;
  const deptColorMap = {};

  // For styling consistency, assign colors to departments
  departments.forEach(dept => {
    deptColorMap[dept] = badgeColors[colorIdx % badgeColors.length];
    colorIdx++;
  });

  Object.keys(grouped).sort().forEach(deptName => {
    const deptReports = grouped[deptName];
    const badgeClass = deptColorMap[deptName] || 'badge-gray';

    const groupDiv = document.createElement('div');
    groupDiv.className = 'dept-group open'; // Default open for better visibility
    
    const accordionHeader = document.createElement('div');
    accordionHeader.className = 'dept-header';
    accordionHeader.innerHTML = `
      <div class="dept-title-box">
        <span class="dept-badge ${badgeClass}">${escapeHtml(deptName)}</span>
        <span class="dept-count">${deptReports.length} report(s)</span>
      </div>
      <i data-lucide="chevron-down" class="dept-toggle-icon"></i>
    `;

    accordionHeader.addEventListener('click', () => {
      groupDiv.classList.toggle('open');
    });

    const accordionContent = document.createElement('div');
    accordionContent.className = 'dept-content';

    const innerGrid = document.createElement('div');
    innerGrid.className = 'reports-grid';

    deptReports.forEach(report => {
      const card = document.createElement('div');
      card.className = 'card glass report-card interactive';
      
      const imageTag = renderReportImages(report.imagePath, `Submitted by ${report.employeeName} (${report.department})`);

      const formattedDate = new Date(report.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      card.innerHTML = `
        <div class="report-header">
          <div class="report-author">
            <h4>${escapeHtml(report.employeeName)}</h4>
            <span class="text-muted" style="background: none; padding: 0;">Sub: ${escapeHtml(report.submittedBy)}</span>
          </div>
          <div class="report-date">${escapeHtml(formattedDate)}</div>
        </div>
        <div class="report-content ql-editor" style="padding: 0; min-height: auto;">${report.content}</div>
        ${imageTag}
        <div class="report-actions" style="margin-top: 1rem; display: flex; gap: 8px; border-top: 1px solid var(--border-glass); padding-top: 0.75rem;">
          <a href="/api/reports/${report.id}/docx" class="table-btn edit-btn" style="text-decoration: none;" title="Download Word Document">
            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Word Doc
          </a>
          <a href="/api/reports/${report.id}/pdf" class="table-btn edit-btn" style="text-decoration: none;" title="Download PDF Document">
            <i data-lucide="file-down" style="width: 14px; height: 14px;"></i> PDF Doc
          </a>
          <button class="table-btn delete-btn" style="margin-left: auto;" onclick="deleteWorkReport('${report.id}')">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete
          </button>
        </div>
      `;
      innerGrid.appendChild(card);
      applyReadMoreToggle(card);
    });

    accordionContent.appendChild(innerGrid);
    groupDiv.appendChild(accordionHeader);
    groupDiv.appendChild(accordionContent);
    container.appendChild(groupDiv);
  });

  lucide.createIcons();
}

// ==================== MANAGEMENT: DEPARTMENTS PAGE ====================
async function loadDepartmentsTable() {
  const tbody = document.getElementById('departments-list-body');
  tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Loading departments...</td></tr>';
  
  try {
    const res = await fetch('/api/departments');
    departments = await res.json();
    
    tbody.innerHTML = '';
    departments.forEach(dept => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(dept)}</strong></td>
        <td><span class="status-pill active">Active</span></td>
        <td style="text-align: right;">
          <div class="action-buttons-cell">
            <button class="table-btn delete-btn" onclick="deleteDepartment('${escapeHtml(dept)}')">
              <i data-lucide="trash-2"></i> Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading departments table:', error);
    tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--error-color);">Failed to load.</td></tr>';
  }
}

async function handleAddDeptSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('new-dept-name');
  const departmentName = nameInput.value.trim();
  
  const successBanner = document.getElementById('dept-success');
  const errBanner = document.getElementById('dept-error');
  const errText = document.getElementById('dept-error-text');

  successBanner.classList.add('hidden');
  errBanner.classList.add('hidden');

  try {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: departmentName })
    });

    const data = await res.json();

    if (res.ok) {
      successBanner.classList.remove('hidden');
      nameInput.value = '';
      
      // Reload lists
      await loadDepartmentsTable();
      populateDepartmentDropdowns();

      setTimeout(() => successBanner.classList.add('hidden'), 5000);
    } else {
      errText.textContent = data.error || 'Failed to add department.';
      errBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error adding department:', error);
    errText.textContent = 'Server communication error. Please try again.';
    errBanner.classList.remove('hidden');
  }
}

// ==================== DIALOG / MODAL FUNCTIONS ====================
function zoomImage(src, caption) {
  imageModal.style.display = 'block';
  modalZoomedImage.src = src;
  modalCaption.textContent = caption;
}

// ==================== HELPER FUNCTIONS ====================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==================== USER MANAGEMENT FUNCTIONS ====================

async function loadUsersTable() {
  const tbody = document.getElementById('users-list-body');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Loading users...</td></tr>';
  
  // Pre-fill Admin credentials form
  document.getElementById('admin-username').value = currentUser.username;
  document.getElementById('admin-password').value = '';

  try {
    const res = await fetch('/api/users');
    const allUsers = await res.json();
    
    // Filter to worker users
    const workers = allUsers.filter(u => u.role === 'worker');

    tbody.innerHTML = '';
    if (workers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No worker accounts registered.</td></tr>';
      return;
    }

    workers.forEach(worker => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(worker.username)}</strong></td>
        <td><span class="status-pill active" style="text-transform: capitalize;">${escapeHtml(worker.role)}</span></td>
        <td style="text-align: right;">
          <div class="action-buttons-cell">
            <button class="table-btn edit-btn" onclick="openEditWorkerModal('${escapeHtml(worker.username)}')">
              <i data-lucide="edit-2"></i> Edit
            </button>
            <button class="table-btn delete-btn" onclick="deleteWorkerAccount('${escapeHtml(worker.username)}')">
              <i data-lucide="trash-2"></i> Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    lucide.createIcons();
  } catch (error) {
    console.error('Error loading users table:', error);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--error-color);">Failed to load workers.</td></tr>';
  }
}

async function handleCreateWorkerSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('worker-username');
  const passwordInput = document.getElementById('worker-password');
  
  const successBanner = document.getElementById('worker-success');
  const errBanner = document.getElementById('worker-error');
  const errText = document.getElementById('worker-error-text');

  successBanner.classList.add('hidden');
  errBanner.classList.add('hidden');

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value
      })
    });

    const data = await res.json();

    if (res.ok) {
      successBanner.classList.remove('hidden');
      usernameInput.value = '';
      passwordInput.value = '';
      
      await loadUsersTable();
      setTimeout(() => successBanner.classList.add('hidden'), 5000);
    } else {
      errText.textContent = data.error || 'Failed to add worker account.';
      errBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error creating worker:', error);
    errText.textContent = 'Server communication error. Please try again.';
    errBanner.classList.remove('hidden');
  }
}

async function handleUpdateAdminSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  
  const successBanner = document.getElementById('admin-success');
  const errBanner = document.getElementById('admin-error');
  const errText = document.getElementById('admin-error-text');

  successBanner.classList.add('hidden');
  errBanner.classList.add('hidden');

  const payload = {
    newUsername: usernameInput.value.trim()
  };
  if (passwordInput.value) {
    payload.newPassword = passwordInput.value;
  }

  try {
    const res = await fetch(`/api/users/${currentUser.username}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      successBanner.classList.remove('hidden');
      passwordInput.value = '';
      
      // Update local credentials state
      currentUser.username = data.user.username;
      userDisplayName.textContent = currentUser.username;
      userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();

      setTimeout(() => successBanner.classList.add('hidden'), 5000);
    } else {
      errText.textContent = data.error || 'Failed to update admin account.';
      errBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error updating admin:', error);
    errText.textContent = 'Server communication error. Please try again.';
    errBanner.classList.remove('hidden');
  }
}

function openEditWorkerModal(username) {
  const modal = document.getElementById('user-edit-modal');
  document.getElementById('edit-worker-target-username').value = username;
  document.getElementById('edit-worker-username').value = username;
  document.getElementById('edit-worker-password').value = '';
  document.getElementById('edit-worker-error').classList.add('hidden');
  modal.style.display = 'block';
}

async function handleEditWorkerSubmit(e) {
  e.preventDefault();
  const targetUsername = document.getElementById('edit-worker-target-username').value;
  const newUsername = document.getElementById('edit-worker-username').value.trim();
  const newPassword = document.getElementById('edit-worker-password').value;
  const modal = document.getElementById('user-edit-modal');
  const errBanner = document.getElementById('edit-worker-error');
  const errText = document.getElementById('edit-worker-error-text');

  errBanner.classList.add('hidden');

  const payload = {
    newUsername
  };
  if (newPassword) {
    payload.newPassword = newPassword;
  }

  try {
    const res = await fetch(`/api/users/${targetUsername}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      modal.style.display = 'none';
      await loadUsersTable();
    } else {
      errText.textContent = data.error || 'Failed to update worker credentials.';
      errBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error editing worker:', error);
    errText.textContent = 'Server communication error. Please try again.';
    errBanner.classList.remove('hidden');
  }
}

async function deleteWorkerAccount(username) {
  if (!confirm(`Are you sure you want to delete the worker account for "${username}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/users/${username}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      await loadUsersTable();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete worker account.');
    }
  } catch (error) {
    console.error('Error deleting worker:', error);
    alert('Server communication error. Please try again.');
  }
}

async function deleteWorkReport(id) {
  if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (res.ok) {
      if (currentUser.role === 'management') {
        await loadManagementDashboard();
      } else {
        await loadWorkerHistory();
        checkSubmissionStatusToday();
      }
    } else {
      alert(data.error || 'Failed to delete report.');
    }
  } catch (error) {
    console.error('Error deleting report:', error);
    alert('Server communication error. Please try again.');
  }
}

// Make functions globally available for inline onclick attributes
window.openEditWorkerModal = openEditWorkerModal;
window.deleteWorkerAccount = deleteWorkerAccount;
window.deleteWorkReport = deleteWorkReport;
window.deleteDepartment = deleteDepartment;

async function deleteDepartment(name) {
  if (!confirm(`Are you sure you want to delete the department "${name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/departments/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      await loadDepartmentsTable();
      await loadDepartments(); // Refresh dropdown list options throughout app
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete department.');
    }
  } catch (error) {
    console.error('Error deleting department:', error);
    alert('Server communication error. Please try again.');
  }
}

function renderReportImages(imagePath, titleText) {
  if (!imagePath) return '';
  
  let images = [];
  if (Array.isArray(imagePath)) {
    images = imagePath;
  } else if (typeof imagePath === 'string') {
    try {
      if (imagePath.startsWith('[')) {
        images = JSON.parse(imagePath);
      } else {
        images = [imagePath];
      }
    } catch (e) {
      images = [imagePath];
    }
  } else {
    images = [imagePath];
  }

  // Filter out any empty entries
  images = images.filter(img => img && typeof img === 'string' && img.trim() !== '');

  if (images.length === 0) return '';

  if (images.length === 1) {
    const imgUrl = images[0];
    return `<img src="${escapeHtml(imgUrl)}" class="report-image-preview" alt="Attached proof of work" onclick="zoomImage('${escapeHtml(imgUrl)}', '${escapeHtml(titleText)}')">`;
  }

  // Gallery view
  let galleryHtml = `<div class="report-gallery">`;
  images.forEach(imgUrl => {
    galleryHtml += `<img src="${escapeHtml(imgUrl)}" class="report-gallery-img" alt="Attached proof of work" onclick="zoomImage('${escapeHtml(imgUrl)}', '${escapeHtml(titleText)}')">`;
  });
  galleryHtml += `</div>`;
  return galleryHtml;
}

function applyReadMoreToggle(cardElement) {
  const contentEl = cardElement.querySelector('.report-content');
  if (!contentEl) return;

  // Defer height evaluation until the element is mounted in the document DOM
  setTimeout(() => {
    if (contentEl.scrollHeight > 180) {
      const container = document.createElement('div');
      container.className = 'report-content-container report-content-collapsed';
      
      // Wrap contentEl in container
      contentEl.parentNode.insertBefore(container, contentEl);
      container.appendChild(contentEl);

      // Create Read More button
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'read-more-btn';
      btn.innerHTML = `<i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i> Read More`;
      
      // Insert button right after container
      container.parentNode.insertBefore(btn, container.nextSibling);

      btn.addEventListener('click', () => {
        const isCollapsed = container.classList.contains('report-content-collapsed');
        if (isCollapsed) {
          container.classList.remove('report-content-collapsed');
          btn.innerHTML = `<i data-lucide="chevron-up" style="width: 14px; height: 14px;"></i> Read Less`;
        } else {
          container.classList.add('report-content-collapsed');
          btn.innerHTML = `<i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i> Read More`;
        }
        lucide.createIcons();
      });
      lucide.createIcons();
    }
  }, 0);
}

// ==================== ANALYTICS DASHBOARD FUNCTIONS ====================

function changeAnalyticsPeriod(period) {
  activeAnalyticsPeriod = period;
  document.getElementById('btn-analytics-7d').classList.toggle('active', period === '7d');
  document.getElementById('btn-analytics-30d').classList.toggle('active', period === '30d');
  document.getElementById('btn-analytics-all').classList.toggle('active', period === 'all');
  loadAnalyticsDashboard();
}

async function loadAnalyticsDashboard() {
  try {
    const res = await fetch('/api/reports/all');
    allReports = await res.json();
    
    // 1. Filter reports based on active parameters
    const now = new Date();
    let cutoffDate = null;
    if (activeAnalyticsPeriod === '7d') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (activeAnalyticsPeriod === '30d') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filteredReports = allReports.filter(r => {
      const date = new Date(r.createdAt);
      const matchesPeriod = !cutoffDate || date >= cutoffDate;
      const matchesDept = !activeAnalyticsDept || r.department === activeAnalyticsDept;
      return matchesPeriod && matchesDept;
    });

    // 2. Render statistics panels
    const totalReportsNode = document.getElementById('analytics-total-reports');
    const activeWorkersNode = document.getElementById('analytics-active-workers');
    const topDeptNode = document.getElementById('analytics-top-dept');

    totalReportsNode.textContent = filteredReports.length;
    activeWorkersNode.textContent = new Set(filteredReports.map(r => r.submittedBy)).size;

    // Calculate top department
    const deptCounts = {};
    filteredReports.forEach(r => {
      deptCounts[r.department] = (deptCounts[r.department] || 0) + 1;
    });
    let topDept = '-';
    let maxCount = 0;
    Object.entries(deptCounts).forEach(([dept, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topDept = dept;
      }
    });
    topDeptNode.textContent = topDept;

    // 3. Render Leaderboard table
    renderLeaderboard(filteredReports);

    // 4. Render charts using Chart.js
    renderAnalyticsCharts(filteredReports);

  } catch (error) {
    console.error('Error loading analytics dashboard:', error);
  }
}

function renderLeaderboard(reports) {
  const workerStats = {};
  reports.forEach(r => {
    const username = r.submittedBy;
    if (!workerStats[username]) {
      workerStats[username] = {
        username: username,
        employeeName: r.employeeName,
        department: r.department,
        count: 0,
        lastActive: new Date(r.createdAt)
      };
    }
    workerStats[username].count++;
    const reportDate = new Date(r.createdAt);
    if (reportDate > workerStats[username].lastActive) {
      workerStats[username].lastActive = reportDate;
      workerStats[username].employeeName = r.employeeName;
      workerStats[username].department = r.department;
    }
  });

  const sortedWorkers = Object.values(workerStats).sort((a, b) => b.count - a.count);
  const tbody = document.getElementById('analytics-leaderboard-body');
  tbody.innerHTML = '';

  if (sortedWorkers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No report data available for the selected period.</td></tr>';
    return;
  }

  const totalInPeriod = reports.length;
  sortedWorkers.forEach((worker, index) => {
    const rank = index + 1;
    const ratio = totalInPeriod > 0 ? ((worker.count / totalInPeriod) * 100).toFixed(1) : 0;
    let rankBadge = `<span class="dept-count" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--border-radius-full);">${rank}</span>`;
    if (rank === 1) {
      rankBadge = `<span style="font-size: 1.25rem;">🏆</span>`;
    } else if (rank === 2) {
      rankBadge = `<span style="font-size: 1.25rem;">🥈</span>`;
    } else if (rank === 3) {
      rankBadge = `<span style="font-size: 1.25rem;">🥉</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${rankBadge}</td>
      <td><strong>${escapeHtml(worker.employeeName)}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${escapeHtml(worker.username)})</span></td>
      <td><span class="status-pill active" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-glass);">${escapeHtml(worker.department)}</span></td>
      <td><strong style="color: var(--primary-color); font-size: 1.05rem;">${worker.count}</strong></td>
      <td style="text-align: right;">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
          <span style="font-size: 0.85rem; font-weight: 500; min-width: 45px; text-align: right;">${ratio}%</span>
          <div style="width: 100px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; display: inline-block;">
            <div style="width: ${ratio}%; height: 100%; background: linear-gradient(90deg, var(--primary-color) 0%, #ef4444 100%); border-radius: 3px;"></div>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAnalyticsCharts(reports) {
  // Destroy existing charts to prevent hover bugs
  if (chartTrend) chartTrend.destroy();
  if (chartDept) chartDept.destroy();
  if (chartWeekly) chartWeekly.destroy();

  const now = new Date();
  
  // Theme options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: { family: 'Inter', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(23, 23, 23, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleFont: { family: 'Poppins', weight: '600' },
        bodyFont: { family: 'Inter' }
      }
    }
  };

  // 1. SUBMISSION TREND CHART
  const trendCanvas = document.getElementById('chart-submission-trend');
  const trendCtx = trendCanvas.getContext('2d');
  
  const trendLabels = [];
  const trendData = [];
  
  const duration = activeAnalyticsPeriod === '7d' ? 7 : (activeAnalyticsPeriod === '30d' ? 30 : null);
  
  if (duration) {
    for (let i = duration - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      // Construct date string formatted identically to local date string matching database
      const dateISOString = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      
      trendLabels.push(dateString);
      
      const count = reports.filter(r => {
        const rDate = new Date(r.createdAt);
        const rISO = rDate.getFullYear() + '-' + String(rDate.getMonth()+1).padStart(2, '0') + '-' + String(rDate.getDate()).padStart(2, '0');
        return rISO === dateISOString;
      }).length;
      
      trendData.push(count);
    }
  } else {
    // All Time Trend: Group by date for all active dates
    const dateMap = {};
    reports.forEach(r => {
      const rDate = new Date(r.createdAt);
      const rISO = rDate.getFullYear() + '-' + String(rDate.getMonth()+1).padStart(2, '0') + '-' + String(rDate.getDate()).padStart(2, '0');
      dateMap[rISO] = (dateMap[rISO] || 0) + 1;
    });
    
    const sortedDates = Object.keys(dateMap).sort();
    sortedDates.forEach(dateISO => {
      const parts = dateISO.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      trendLabels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      trendData.push(dateMap[dateISO]);
    });
  }

  const trendGradient = trendCtx.createLinearGradient(0, 0, 0, 250);
  trendGradient.addColorStop(0, 'rgba(220, 38, 38, 0.35)');
  trendGradient.addColorStop(1, 'rgba(220, 38, 38, 0.0)');

  chartTrend = new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: trendLabels.length > 0 ? trendLabels : ['No data'],
      datasets: [{
        label: 'Submissions',
        data: trendData.length > 0 ? trendData : [0],
        borderColor: '#dc2626',
        borderWidth: 2.5,
        backgroundColor: trendGradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: '#09090b',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#dc2626',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      ...chartOptions,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { 
            color: 'rgba(255, 255, 255, 0.6)', 
            font: { family: 'Inter' },
            stepSize: 1,
            precision: 0
          },
          min: 0
        }
      }
    }
  });

  // 2. BREAKDOWN DOUGHNUT CHART
  const breakdownCounts = {};
  const doughnutCard = document.getElementById('chart-dept-distribution').closest('.chart-card');
  const doughnutTitle = doughnutCard.querySelector('.chart-header h3');
  const doughnutSubtitle = doughnutCard.querySelector('.chart-header p');

  if (!activeAnalyticsDept) {
    doughnutTitle.innerHTML = `<i data-lucide="pie-chart"></i> Department Breakdown`;
    doughnutSubtitle.textContent = `Report submissions distribution`;
    reports.forEach(r => {
      breakdownCounts[r.department] = (breakdownCounts[r.department] || 0) + 1;
    });
  } else {
    doughnutTitle.innerHTML = `<i data-lucide="user"></i> Employee Breakdown`;
    doughnutSubtitle.textContent = `Submissions within ${activeAnalyticsDept}`;
    reports.forEach(r => {
      breakdownCounts[r.employeeName] = (breakdownCounts[r.employeeName] || 0) + 1;
    });
  }
  lucide.createIcons();

  const breakLabels = Object.keys(breakdownCounts);
  const breakData = Object.values(breakdownCounts);

  const colors = [
    'rgba(220, 38, 38, 0.85)',
    'rgba(244, 63, 94, 0.85)',
    'rgba(59, 130, 246, 0.85)',
    'rgba(16, 185, 129, 0.85)',
    'rgba(245, 158, 11, 0.85)',
    'rgba(168, 85, 247, 0.85)',
    'rgba(6, 182, 212, 0.85)',
    'rgba(236, 72, 153, 0.85)',
    'rgba(107, 114, 128, 0.85)'
  ];
  const borderColors = breakLabels.map(() => '#171717');

  chartDept = new Chart(document.getElementById('chart-dept-distribution'), {
    type: 'doughnut',
    data: {
      labels: breakLabels.length > 0 ? breakLabels : ['No data'],
      datasets: [{
        data: breakData.length > 0 ? breakData : [1],
        backgroundColor: breakData.length > 0 ? colors.slice(0, breakLabels.length) : ['rgba(255,255,255,0.05)'],
        borderColor: borderColors.length > 0 ? borderColors : ['rgba(255,255,255,0.08)'],
        borderWidth: 2
      }]
    },
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        legend: {
          position: 'right',
          labels: {
            color: 'rgba(255, 255, 255, 0.7)',
            font: { family: 'Inter', size: 11 },
            boxWidth: 10
          }
        }
      },
      cutout: '65%'
    }
  });

  // 3. WEEKLY DISTRIBUTION BAR CHART
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  reports.forEach(r => {
    const d = new Date(r.createdAt);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const shiftedIdx = day === 0 ? 6 : day - 1; // Mon=0, ..., Sun=6
    weekdayCounts[shiftedIdx]++;
  });

  chartWeekly = new Chart(document.getElementById('chart-weekly-density'), {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Submissions',
        data: weekdayCounts,
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
        hoverBackgroundColor: '#dc2626',
        borderRadius: 5,
        borderWidth: 0
      }]
    },
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { 
            color: 'rgba(255, 255, 255, 0.6)', 
            font: { family: 'Inter' },
            stepSize: 1,
            precision: 0
          },
          min: 0
        }
      }
    }
  });
}

