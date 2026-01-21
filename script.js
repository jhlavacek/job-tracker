/**
 * Job Tracker - Main JavaScript
 *
 * A client-side job application tracker with localStorage persistence.
 * Features: Kanban board, drag & drop, job coach tracking, smart import.
 */

// ============================================
// Data Model & State
// ============================================

/** @type {Array} Array of job application objects */
let jobs = [];

/** @type {Array} Array of job coach objects */
let coaches = [];

/** @type {Array} Temporary tasks array for the current modal */
let currentTasks = [];

/** @type {Function|null} Callback for confirmation dialog */
let confirmCallback = null;

/** @type {string} Currently active tab ('jobs' or 'coach') */
let currentTab = 'jobs';

/** @type {Date} Target date for the job search goal */
const GOAL_DATE = new Date('2026-04-30');

// Job stages in order of progression
// Used for rendering the Kanban board and validating stage transitions
const JOB_STAGES = ['pipeline', 'applied', 'interview', 'final', 'offer'];

// Track which job cards are expanded (persists across re-renders)
const expandedCards = new Set();

// View mode: true when running on GitHub Pages (read-only for visitors)
let isViewMode = false;

// Stage display labels
const STAGE_LABELS = {
    pipeline: 'Company Pipeline',
    applied: 'Applied',
    interview: 'Interview Set',
    final: 'Final Round',
    offer: 'Offer'
};

// Default job entry (shown when no data exists)
const defaultJobs = [
    {
        id: 'compound-planning-sdr-001',
        company: 'Compound Planning',
        role: 'Sales Development Representative (SDR)',
        address: '115 Broadway, 5th Floor, New York, NY 10006',
        companyWebsite: 'https://www.compoundplanning.com',
        salary: '$50k-$70k base + commission',
        dateApplied: '2026-01-17',
        stage: 'pipeline',
        contactName: '',
        contactInfo: 'careers@compoundplanning.com',
        tags: ['SDR', 'Fintech', 'Wealth Management', 'Remote', 'Tech Sales'],
        notes: 'Compound Planning is a digital family office for tech professionals. Y Combinator backed (2019). Manages $2.5B+ AUM.',
        tasks: [
            { text: 'Research company culture', completed: false },
            { text: 'Tailor resume for fintech', completed: false },
            { text: 'Submit application', completed: false }
        ],
        interviewDate: '',
        interviewTime: ''
    }
];

// ============================================
// Initialization
// ============================================

/**
 * Initialize the application on page load.
 * Detects if running on GitHub Pages (view mode) or locally (edit mode).
 * Loads data from localStorage (local) or data.json (GitHub Pages).
 */
async function init() {
    // Detect if running on GitHub Pages
    isViewMode = window.location.hostname.includes('github.io');

    if (isViewMode) {
        // Load from data.json file for GitHub Pages visitors
        await loadDataFromFile();
        applyViewMode();
    } else {
        // Load from localStorage for local editing
        loadData();
    }

    updateCountdown();
    // Update countdown every minute
    setInterval(updateCountdown, 60000);
}

/**
 * Loads data from data.json file (used on GitHub Pages).
 */
async function loadDataFromFile() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        jobs = data.jobs || [];
        coaches = data.coaches || [];
        renderAll();
    } catch (error) {
        console.error('Failed to load data.json:', error);
        jobs = [];
        coaches = [];
        renderAll();
    }
}

/**
 * Applies view mode restrictions (hides edit controls, disables interactions).
 */
function applyViewMode() {
    document.body.classList.add('view-mode');
}

// ============================================
// Countdown Timer
// ============================================

/**
 * Updates the countdown display showing days until the goal date.
 * Adds urgency styling when approaching the deadline.
 */
function updateCountdown() {
    const now = new Date();
    const diff = GOAL_DATE - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    const el = document.getElementById('daysLeft');
    el.textContent = days;
    el.className = 'countdown-number';

    // Add urgency classes based on remaining time
    if (days <= 30) el.classList.add('critical');
    else if (days <= 60) el.classList.add('urgent');
}

// ============================================
// Data Persistence (localStorage)
// ============================================

/**
 * Loads job and coach data from localStorage.
 * If no data exists, initializes with default entries.
 * Migrates old stage names to new ones for backward compatibility.
 */
function loadData() {
    const saved = localStorage.getItem('jobTrackerData');
    if (saved) jobs = JSON.parse(saved);

    if (jobs.length === 0) {
        jobs = [...defaultJobs];
    }

    // 🔴 STAGE NORMALIZATION (CRITICAL)
    jobs = jobs.map(job => {
        if (!job.stage || job.stage === 'wishlist') job.stage = 'pipeline';
        if (job.stage === 'screening') job.stage = 'applied';
        // Migrate location to address
        if (job.location && !job.address) {
            job.address = job.location;
            delete job.location;
        }
        // Fix Compound Planning data
        if (job.company === 'Compound Planning') {
            job.address = '115 Broadway, 5th Floor, New York, NY 10006';
            job.companyWebsite = 'https://www.compoundplanning.com';
        }
        // Migrate careerWebsite to companyWebsite
        if (job.careerWebsite && !job.companyWebsite) {
            job.companyWebsite = job.careerWebsite.replace('/careers', '');
            delete job.careerWebsite;
        }
        return job;
    });

    saveData();

    const savedCoaches = localStorage.getItem('jobTrackerCoaches');
    if (savedCoaches) coaches = JSON.parse(savedCoaches);

    renderAll();
}

/**
 * Saves job data to localStorage and re-renders the UI.
 */
function saveData() {
    localStorage.setItem('jobTrackerData', JSON.stringify(jobs));
    renderAll();
}

/**
 * Saves coach data to localStorage and re-renders the UI.
 */
function saveCoachData() {
    localStorage.setItem('jobTrackerCoaches', JSON.stringify(coaches));
    renderAll();
}

/**
 * Re-renders all UI components.
 */
function renderAll() {
    renderBoard();
    renderCoaches();
    updateStats();
    renderThisWeek();
}

/**
 * Generates a unique ID for new entries.
 * @returns {string} A unique identifier
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================
// Statistics Dashboard
// ============================================

/**
 * Updates all statistics cards in the dashboard.
 * Uses new stage names: pipeline, applied, interview, final, offer
 */
function updateStats() {
    const total = jobs.length;
    // "Applied" = all jobs past the pipeline stage
    const applied = jobs.filter(j => j.stage !== 'pipeline').length;
    // "Interviews" = jobs in interview or final round stages
    const interviews = jobs.filter(j => ['interview', 'final'].includes(j.stage)).length;
    const offers = jobs.filter(j => j.stage === 'offer').length;
    // "Responded" = jobs that got past applied stage (interview, final, or offer)
    const responded = jobs.filter(j => ['interview', 'final', 'offer'].includes(j.stage)).length;
    const responseRate = applied > 0 ? Math.round((responded / applied) * 100) : 0;

    // Count items scheduled this week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const thisWeek = jobs.filter(j => {
        if (!j.interviewDate) return false;
        const d = new Date(j.interviewDate);
        return d >= weekStart && d < weekEnd;
    }).length;

    // Update DOM
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-applied').textContent = applied;
    document.getElementById('stat-interviews').textContent = interviews;
    document.getElementById('stat-offers').textContent = offers;
    document.getElementById('stat-response').textContent = responseRate + '%';
    document.getElementById('stat-weekly').textContent = thisWeek;

    // Progress bar (100% if offer received, otherwise based on pipeline progress)
    const progress = offers > 0 ? 100 : Math.min(95, (interviews * 20) + (applied * 2));
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressPercent').textContent = progress + '%';
}

// ============================================
// This Week Section
// ============================================

/**
 * Renders the "Coming Up This Week" section with scheduled interviews and meetings.
 */
function renderThisWeek() {
    const container = document.getElementById('weekItems');
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    const items = [];

    // Collect job interviews
    jobs.forEach(job => {
        if (job.interviewDate) {
            const d = new Date(job.interviewDate);
            if (d >= now && d <= weekEnd) {
                items.push({
                    type: 'job',
                    date: job.interviewDate,
                    time: job.interviewTime,
                    calendarUrl: job.calendarEventUrl,
                    title: job.company,
                    subtitle: job.role,
                    stage: job.stage
                });
            }
        }
    });

    // Collect coach meetings
    coaches.forEach(coach => {
        if (coach.meetingDate) {
            const d = new Date(coach.meetingDate);
            if (d >= now && d <= weekEnd) {
                items.push({
                    type: 'coach',
                    date: coach.meetingDate,
                    time: coach.meetingTime,
                    calendarUrl: coach.calendarUrl,
                    title: coach.name,
                    subtitle: coach.specialty || 'Job Coach'
                });
            }
        }
    });

    // Sort by date
    items.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Render
    if (items.length === 0) {
        container.innerHTML = '<div class="empty-week">No interviews or meetings scheduled this week. Keep applying!</div>';
        return;
    }

    container.innerHTML = items.map(item => {
        // Append T00:00:00 to parse as local time, not UTC
        const d = new Date(item.date + 'T00:00:00');
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = item.time ? formatTime(item.time) : '';

        return `
            <div class="week-item ${item.type}">
                <div class="week-item-header">
                    <span class="week-item-date">${dateStr} ${timeStr}</span>
                    <span class="week-item-type">${item.type === 'job' ? 'Interview' : 'Coach Meeting'}</span>
                </div>
                <div class="week-item-title">${escapeHtml(item.title)}</div>
                <div class="week-item-subtitle">${escapeHtml(item.subtitle)}</div>
            </div>
        `;
    }).join('');
}

/**
 * Formats a time string (HH:MM) to 12-hour format with AM/PM.
 * @param {string} timeStr - Time in HH:MM format
 * @returns {string} Formatted time string
 */
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

// ============================================
// Kanban Board
// ============================================

/**
 * Renders the kanban board with all job cards in their respective columns.
 * Uses the new 5-stage model: pipeline, applied, interview, final, offer
 */
function renderBoard() {
    const stages = ['pipeline', 'applied', 'interview', 'final', 'offer'];

    stages.forEach(stage => {
        const column = document.querySelector(`.column[data-stage="${stage}"]`);
        const container = document.querySelector(`.cards-container[data-stage="${stage}"]`);

        if (!column || !container) return;

        const stageJobs = jobs.filter(j => j.stage === stage);
        column.querySelector('.column-count').textContent = stageJobs.length;

        container.innerHTML = stageJobs.map(job => createJobCard(job)).join('');
    });
}

/**
 * Creates the HTML for a job card.
 * No longer draggable - uses button-driven stage progression.
 * @param {Object} job - The job object
 * @returns {string} HTML string for the job card
 */
function createJobCard(job) {
    const hasInterview = job.interviewDate && new Date(job.interviewDate) >= new Date();
    const interviewBadge = hasInterview ?
        `<span class="job-interview-badge">${formatDateShort(job.interviewDate)} ${job.interviewTime ? formatTime(job.interviewTime) : ''}</span>` : '';

    // Build metadata line
    const meta = [];
    if (job.address || job.location) {
        const addr = job.address || job.location;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
        meta.push(`<a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link" title="Open in Google Maps">📍</a> ${escapeHtml(addr)}`);
    }
    if (job.salary) meta.push(`💰 ${escapeHtml(job.salary)}`);

    // Build tags
    const tags = job.tags?.length ?
        `<div class="job-tags">${job.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';

    // Build expandable section (notes + tasks)
    const isExpanded = expandedCards.has(job.id);
    const notesDisplay = job.notes
        ? `<div class="job-notes-display" onclick="editJobNotes('${job.id}')">${escapeHtml(job.notes)}</div>`
        : `<div class="job-notes-empty" onclick="editJobNotes('${job.id}')">Click to add notes...</div>`;

    const expanded = `
        <button class="expand-btn" onclick="toggleExpand(this, '${job.id}')" aria-expanded="${isExpanded}">${isExpanded ? 'Show less ▲' : 'Show more ▼'}</button>
        <div class="job-expanded ${isExpanded ? 'show' : ''}">
            <div class="job-notes-section" data-job-id="${job.id}">
                ${notesDisplay}
                <div class="job-notes-edit" style="display: none;">
                    <textarea class="job-notes-textarea" placeholder="Add notes...">${escapeHtml(job.notes || '')}</textarea>
                    <div class="job-notes-actions">
                        <button class="btn-save-notes" onclick="saveJobNotes('${job.id}')">Save</button>
                        <button class="btn-cancel-notes" onclick="cancelEditNotes('${job.id}')">Cancel</button>
                    </div>
                </div>
            </div>
            ${job.tasks?.length ? `<div class="job-tasks">${job.tasks.map((t, i) => `
                <div class="job-task ${t.completed ? 'completed' : ''}">
                    <input type="checkbox" ${t.completed ? 'checked' : ''}
                           onchange="toggleTask('${job.id}',${i},this.checked)"
                           aria-label="Mark task as ${t.completed ? 'incomplete' : 'complete'}">
                    <span>${escapeHtml(t.text)}</span>
                </div>
            `).join('')}</div>` : ''}
        </div>
    `;

    // Stage navigation buttons
    const nextStage = getNextStage(job.stage);
    const prevStage = getPreviousStage(job.stage);

    // "← Move Back" button - disabled if at first stage (pipeline)
    const moveBackBtn = prevStage
        ? `<button class="btn-move-stage btn-move-back" onclick="confirmMoveStageBack('${job.id}')" title="Move back to ${STAGE_LABELS[prevStage]}" aria-label="Move ${job.company} back to ${STAGE_LABELS[prevStage]}">←</button>`
        : `<button class="btn-move-stage btn-move-back" disabled title="Already at first stage" aria-label="Already at pipeline stage">←</button>`;

    // "Move Forward →" button - disabled if at final stage (offer)
    const moveForwardBtn = nextStage
        ? `<button class="btn-move-stage btn-move-forward" onclick="confirmMoveStage('${job.id}')" title="Move to ${STAGE_LABELS[nextStage]}" aria-label="Move ${job.company} to ${STAGE_LABELS[nextStage]}">→</button>`
        : `<button class="btn-move-stage btn-move-forward" disabled title="Already at final stage" aria-label="Already at offer stage">✓</button>`;

    // Company name - clickable to open company website in popup window
    const companyDisplay = job.companyWebsite
        ? `<a href="#" onclick="openCompanyPopup('${escapeHtml(job.companyWebsite)}'); return false;" class="job-company-link">${escapeHtml(job.company)}</a>`
        : `<span>${escapeHtml(job.company)}</span>`;

    return `
        <div class="job-card ${hasInterview ? 'has-interview' : ''}" data-id="${job.id}" data-stage="${job.stage}">
            <div class="job-card-header">
                <span class="job-company">${companyDisplay}</span>
                <div class="job-card-actions">
                    ${moveBackBtn}
                    ${moveForwardBtn}
                    <button onclick="openEditModal('${job.id}')" title="Edit" aria-label="Edit ${job.company}">✏️</button>
                </div>
            </div>
            <div class="job-role">${escapeHtml(job.role)}</div>
            ${interviewBadge}
            ${meta.length ? `<div class="job-meta">${meta.join(' · ')}</div>` : ''}
            ${tags}
            ${expanded}
        </div>
    `;
}

/**
 * Formats a date string to short format (e.g., "Jan 15").
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDateShort(dateStr) {
    // Append T00:00:00 to parse as local time, not UTC
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Toggles the expanded section of a job card.
 * @param {HTMLElement} btn - The expand button element
 * @param {string} jobId - The job's ID
 */
function toggleExpand(btn, jobId) {
    const exp = btn.nextElementSibling;
    const show = !exp.classList.contains('show');
    exp.classList.toggle('show', show);
    btn.textContent = show ? 'Show less ▲' : 'Show more ▼';
    btn.setAttribute('aria-expanded', show);

    // Track expanded state
    if (show) {
        expandedCards.add(jobId);
    } else {
        expandedCards.delete(jobId);
    }
}

/**
 * Opens the notes editor for a job.
 * @param {string} jobId - The job's ID
 */
function editJobNotes(jobId) {
    const section = document.querySelector(`.job-notes-section[data-job-id="${jobId}"]`);
    if (!section) return;

    const display = section.querySelector('.job-notes-display, .job-notes-empty');
    const editDiv = section.querySelector('.job-notes-edit');

    if (display) display.style.display = 'none';
    editDiv.style.display = 'block';
    editDiv.querySelector('textarea').focus();
}

/**
 * Saves job notes and switches back to display mode.
 * @param {string} jobId - The job's ID
 */
function saveJobNotes(jobId) {
    const section = document.querySelector(`.job-notes-section[data-job-id="${jobId}"]`);
    if (!section) return;

    const textarea = section.querySelector('.job-notes-textarea');
    const notes = textarea.value.trim();

    const job = jobs.find(j => j.id === jobId);
    if (job) {
        job.notes = notes;
        localStorage.setItem('jobTrackerData', JSON.stringify(jobs));
    }

    // Update display
    const editDiv = section.querySelector('.job-notes-edit');
    editDiv.style.display = 'none';

    // Remove old display and create new one
    const oldDisplay = section.querySelector('.job-notes-display, .job-notes-empty');
    if (oldDisplay) oldDisplay.remove();

    const newDisplay = document.createElement('div');
    if (notes) {
        newDisplay.className = 'job-notes-display';
        newDisplay.textContent = notes;
    } else {
        newDisplay.className = 'job-notes-empty';
        newDisplay.textContent = 'Click to add notes...';
    }
    newDisplay.onclick = () => editJobNotes(jobId);
    section.insertBefore(newDisplay, editDiv);
}

/**
 * Cancels notes editing and reverts to display mode.
 * @param {string} jobId - The job's ID
 */
function cancelEditNotes(jobId) {
    const section = document.querySelector(`.job-notes-section[data-job-id="${jobId}"]`);
    if (!section) return;

    const job = jobs.find(j => j.id === jobId);
    const textarea = section.querySelector('.job-notes-textarea');
    textarea.value = job?.notes || '';

    const display = section.querySelector('.job-notes-display, .job-notes-empty');
    const editDiv = section.querySelector('.job-notes-edit');

    if (display) display.style.display = 'block';
    editDiv.style.display = 'none';
}

/**
 * Toggles a task's completed status without collapsing the card.
 * @param {string} jobId - The job's ID
 * @param {number} idx - The task index
 * @param {boolean} completed - New completed status
 */
function toggleTask(jobId, idx, completed) {
    const job = jobs.find(j => j.id === jobId);
    if (job?.tasks?.[idx]) {
        job.tasks[idx].completed = completed;
        // Save without full re-render to keep card expanded
        localStorage.setItem('jobTrackerData', JSON.stringify(jobs));

        // Just update the task element's class
        const card = document.querySelector(`.job-card[data-id="${jobId}"]`);
        if (card) {
            const taskDivs = card.querySelectorAll('.job-task');
            if (taskDivs[idx]) {
                taskDivs[idx].classList.toggle('completed', completed);
            }
        }

        // Update stats without full re-render
        updateStats();
    }
}

// ============================================
// Stage Progression (Button-Driven)
// ============================================
// Replaces drag-and-drop with explicit button confirmation.
// Jobs progress through: pipeline → applied → interview → final → offer

/**
 * Gets the next stage in the pipeline progression.
 * @param {string} currentStage - The current stage
 * @returns {string|null} The next stage, or null if at final stage (offer)
 */
function getNextStage(currentStage) {
    const currentIndex = JOB_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= JOB_STAGES.length - 1) {
        return null; // Already at offer or invalid stage
    }
    return JOB_STAGES[currentIndex + 1];
}

/**
 * Gets the previous stage in the pipeline progression.
 * @param {string} currentStage - The current stage
 * @returns {string|null} The previous stage, or null if at first stage (pipeline)
 */
function getPreviousStage(currentStage) {
    const currentIndex = JOB_STAGES.indexOf(currentStage);
    if (currentIndex <= 0) {
        return null; // Already at pipeline or invalid stage
    }
    return JOB_STAGES[currentIndex - 1];
}

/**
 * Shows confirmation modal for moving a job to the next stage.
 * @param {string} jobId - The ID of the job to move
 */
function confirmMoveStage(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const nextStage = getNextStage(job.stage);
    if (!nextStage) return; // Already at final stage

    const currentLabel = STAGE_LABELS[job.stage];
    const nextLabel = STAGE_LABELS[nextStage];

    openConfirmModal(
        'Move Forward',
        `Move "${job.company}" from ${currentLabel} to ${nextLabel}?`,
        () => {
            job.stage = nextStage;
            saveData();
        }
    );
}

/**
 * Shows soft warning modal for moving a job back to the previous stage.
 * @param {string} jobId - The ID of the job to move back
 */
function confirmMoveStageBack(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const prevStage = getPreviousStage(job.stage);
    if (!prevStage) return; // Already at first stage

    const currentLabel = STAGE_LABELS[job.stage];
    const prevLabel = STAGE_LABELS[prevStage];

    openConfirmModal(
        'Move Back',
        `Move "${job.company}" back from ${currentLabel} to ${prevLabel}?`,
        () => {
            job.stage = prevStage;
            saveData();
        }
    );
}

/**
 * Opens a company website in a popup window.
 * @param {string} url - The URL to open
 */
function openCompanyPopup(url) {
    const width = 1000;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    window.open(url, 'companyPopup', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
}

// ============================================
// Job Modal (Add/Edit)
// ============================================

/**
 * Opens the modal for adding a new job.
 */
function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add New Job';
    document.getElementById('jobForm').reset();
    document.getElementById('jobId').value = '';
    document.getElementById('dateApplied').value = new Date().toISOString().split('T')[0];
    document.getElementById('stage').value = 'pipeline';
    document.getElementById('deleteJobBtn').style.display = 'none';
    currentTasks = [];
    renderTasks();
    document.getElementById('jobModal').classList.add('show');
    // Focus the first input
    document.getElementById('company').focus();
}

/**
 * Opens the modal for editing an existing job.
 * @param {string} jobId - The ID of the job to edit
 */
function openEditModal(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('modalTitle').textContent = 'Edit Job';
    document.getElementById('jobId').value = job.id;
    document.getElementById('deleteJobBtn').style.display = 'block';
    document.getElementById('company').value = job.company;
    document.getElementById('role').value = job.role;
    document.getElementById('companyWebsite').value = job.companyWebsite || job.careerWebsite || '';
    document.getElementById('address').value = job.address || job.location || '';
    document.getElementById('salary').value = job.salary || '';
    document.getElementById('dateApplied').value = job.dateApplied || '';
    document.getElementById('stage').value = job.stage;
    document.getElementById('interviewDate').value = job.interviewDate || '';
    document.getElementById('interviewTime').value = job.interviewTime || '';
    document.getElementById('calendarEventUrl').value = job.calendarEventUrl || '';
    document.getElementById('contactName').value = job.contactName || '';
    document.getElementById('contactInfo').value = job.contactInfo || '';
    document.getElementById('tags').value = job.tags?.join(', ') || '';
    document.getElementById('notes').value = job.notes || '';
    currentTasks = job.tasks ? [...job.tasks] : [];
    renderTasks();
    document.getElementById('jobModal').classList.add('show');
}

/**
 * Closes the job modal.
 */
function closeModal() {
    document.getElementById('jobModal').classList.remove('show');
    currentTasks = [];
}

/**
 * Deletes the job being edited from within the modal.
 */
function deleteJobFromModal() {
    const jobId = document.getElementById('jobId').value;
    if (!jobId) return;

    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    if (confirm(`Delete "${job.company}" from your job tracker?`)) {
        jobs = jobs.filter(j => j.id !== jobId);
        saveData();
        closeModal();
    }
}

/**
 * Saves the job from the modal form.
 * Validates required fields before saving.
 */
function saveJob() {
    const company = document.getElementById('company').value.trim();
    const role = document.getElementById('role').value.trim();
    const address = document.getElementById('address').value.trim();
    const companyWebsite = document.getElementById('companyWebsite').value.trim();

    // Validation
    if (!company || !role || !address || !companyWebsite) {
        alert('Company, Role, Address, and Company Website are required fields.');
        return;
    }

    const jobId = document.getElementById('jobId').value;
    const tagsVal = document.getElementById('tags').value;
    const tags = tagsVal ? tagsVal.split(',').map(t => t.trim()).filter(t => t) : [];

    const data = {
        company,
        role,
        address,
        companyWebsite,
        salary: document.getElementById('salary').value.trim(),
        dateApplied: document.getElementById('dateApplied').value,
        stage: document.getElementById('stage').value,
        interviewDate: document.getElementById('interviewDate').value,
        interviewTime: document.getElementById('interviewTime').value,
        calendarEventUrl: document.getElementById('calendarEventUrl').value.trim(),
        contactName: document.getElementById('contactName').value.trim(),
        contactInfo: document.getElementById('contactInfo').value.trim(),
        tags,
        notes: document.getElementById('notes').value.trim(),
        tasks: currentTasks
    };

    if (jobId) {
        // Update existing job
        const idx = jobs.findIndex(j => j.id === jobId);
        if (idx !== -1) {
            jobs[idx] = { ...jobs[idx], ...data };
        }
    } else {
        // Create new job
        data.id = generateId();
        jobs.push(data);
    }

    saveData();
    closeModal();
}

/**
 * Renders the tasks list in the modal.
 */
function renderTasks() {
    document.getElementById('tasksList').innerHTML = currentTasks.map((t, i) => `
        <div class="task-item">
            <input type="checkbox" ${t.completed ? 'checked' : ''}
                   onchange="currentTasks[${i}].completed=this.checked"
                   aria-label="Task completed">
            <span>${escapeHtml(t.text)}</span>
            <button type="button" onclick="currentTasks.splice(${i},1);renderTasks()" aria-label="Remove task">&times;</button>
        </div>
    `).join('');
}

/**
 * Adds a new task to the current tasks list.
 */
function addTask() {
    const input = document.getElementById('newTask');
    if (input.value.trim()) {
        currentTasks.push({ text: input.value.trim(), completed: false });
        input.value = '';
        renderTasks();
    }
}

// ============================================
// Coach Section
// ============================================

/**
 * Renders all coach cards in the coach grid.
 */
function renderCoaches() {
    const grid = document.getElementById('coachGrid');
    const empty = document.getElementById('coachEmptyState');

    if (coaches.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = coaches.map(c => createCoachCard(c)).join('');
}

/**
 * Creates the HTML for a coach card.
 * @param {Object} coach - The coach object
 * @returns {string} HTML string for the coach card
 */
function createCoachCard(coach) {
    const statusLabels = {
        researching: 'Researching',
        contacted: 'Contacted',
        consulting: 'In Consultation',
        hired: 'Hired',
        declined: 'Declined'
    };

    const stars = coach.rating ? '★'.repeat(coach.rating) + '☆'.repeat(5 - coach.rating) : '';
    const hasMeeting = coach.meetingDate && new Date(coach.meetingDate) >= new Date();

    // Build details
    const details = [];
    if (coach.price) details.push(`💰 ${escapeHtml(coach.price)}`);
    if (coach.email) details.push(`📧 ${escapeHtml(coach.email)}`);
    if (coach.phone) details.push(`📱 ${escapeHtml(coach.phone)}`);

    // Upcoming Meeting element - clickable to open Outlook calendar
    // We store meetingDate (YYYY-MM-DD) and meetingTime (HH:MM) as data attributes
    // so the click handler can build the Outlook calendar URL without parsing display text
    const meeting = hasMeeting ? `
        <button class="coach-meeting coach-meeting-clickable"
                onclick="openOutlookCalendar('${coach.meetingDate}', '${coach.meetingTime || ''}')"
                data-meeting-date="${coach.meetingDate}"
                data-meeting-time="${coach.meetingTime || ''}"
                aria-label="Open meeting in Outlook calendar"
                title="Click to open in Outlook Calendar">
            <div class="coach-meeting-label">Upcoming Meeting</div>
            <div class="coach-meeting-datetime">
                ${formatDateShort(coach.meetingDate)} ${coach.meetingTime ? formatTime(coach.meetingTime) : ''}
            </div>
            <div class="coach-meeting-hint">Click to open in Outlook</div>
        </button>
    ` : '';

    // Meeting Notes button - opens dedicated notes view for this coach
    // The coach.id is passed to openMeetingNotes for candidate-to-notes mapping
    const meetingNotesBtn = `
        <button class="btn btn-meeting-notes" onclick="openMeetingNotes('${coach.id}')" aria-label="Meeting notes for ${coach.name}">
            📝 Meeting Notes
        </button>
    `;

    return `
        <div class="coach-card ${hasMeeting ? 'has-meeting' : ''}" data-id="${coach.id}">
            <div class="coach-card-header">
                <div>
                    <span class="coach-name">${escapeHtml(coach.name)}</span>
                    ${stars ? `<span class="coach-rating">${stars}</span>` : ''}
                </div>
                <div class="job-card-actions">
                    <button onclick="openEditCoachModal('${coach.id}')" aria-label="Edit ${coach.name}">✏️</button>
                    <button class="delete" onclick="confirmDeleteCoach('${coach.id}')" aria-label="Delete ${coach.name}">🗑️</button>
                </div>
            </div>
            ${coach.specialty ? `<div class="coach-specialty">${escapeHtml(coach.specialty)}</div>` : ''}
            <span class="coach-status ${coach.status}">${statusLabels[coach.status]}</span>
            ${details.length ? `<div class="coach-details">${details.join('<br>')}</div>` : ''}
            ${meeting}
            ${coach.notes ? `<div class="coach-notes">${escapeHtml(coach.notes)}</div>` : ''}
            ${meetingNotesBtn}
        </div>
    `;
}

/**
 * Opens the modal for adding a new coach.
 */
function openCoachModal() {
    document.getElementById('coachModalTitle').textContent = 'Add Job Coach';
    document.getElementById('coachForm').reset();
    document.getElementById('coachId').value = '';
    document.getElementById('coachStatus').value = 'researching';
    document.getElementById('coachModal').classList.add('show');
    document.getElementById('coachName').focus();
}

/**
 * Opens the modal for editing an existing coach.
 * @param {string} coachId - The ID of the coach to edit
 */
function openEditCoachModal(coachId) {
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) return;

    document.getElementById('coachModalTitle').textContent = 'Edit Job Coach';
    document.getElementById('coachId').value = coach.id;
    document.getElementById('coachName').value = coach.name;
    document.getElementById('coachSpecialty').value = coach.specialty || '';
    document.getElementById('coachPrice').value = coach.price || '';
    document.getElementById('coachRating').value = coach.rating || '';
    document.getElementById('coachEmail').value = coach.email || '';
    document.getElementById('coachPhone').value = coach.phone || '';
    document.getElementById('coachWebsite').value = coach.website || '';
    document.getElementById('coachMeetingDate').value = coach.meetingDate || '';
    document.getElementById('coachMeetingTime').value = coach.meetingTime || '';
    document.getElementById('coachCalendarUrl').value = coach.calendarUrl || '';
    document.getElementById('coachStatus').value = coach.status || 'researching';
    document.getElementById('coachNotes').value = coach.notes || '';
    document.getElementById('coachModal').classList.add('show');
}

/**
 * Closes the coach modal.
 */
function closeCoachModal() {
    document.getElementById('coachModal').classList.remove('show');
}

/**
 * Saves the coach from the modal form.
 */
function saveCoach() {
    const name = document.getElementById('coachName').value.trim();

    if (!name) {
        alert('Coach name is required.');
        return;
    }

    const coachId = document.getElementById('coachId').value;
    const data = {
        name,
        specialty: document.getElementById('coachSpecialty').value.trim(),
        price: document.getElementById('coachPrice').value.trim(),
        rating: document.getElementById('coachRating').value ? parseInt(document.getElementById('coachRating').value) : null,
        email: document.getElementById('coachEmail').value.trim(),
        phone: document.getElementById('coachPhone').value.trim(),
        website: document.getElementById('coachWebsite').value.trim(),
        meetingDate: document.getElementById('coachMeetingDate').value,
        meetingTime: document.getElementById('coachMeetingTime').value,
        calendarUrl: document.getElementById('coachCalendarUrl').value.trim(),
        status: document.getElementById('coachStatus').value,
        notes: document.getElementById('coachNotes').value.trim()
    };

    if (coachId) {
        const idx = coaches.findIndex(c => c.id === coachId);
        if (idx !== -1) {
            coaches[idx] = { ...coaches[idx], ...data };
        }
    } else {
        data.id = generateId();
        coaches.push(data);
    }

    saveCoachData();
    closeCoachModal();
}

// ============================================
// Meeting Notes Feature
// ============================================
// Meeting notes are stored separately from coach data in localStorage.
// Each coach's notes are keyed by their unique ID for easy retrieval.
// This keeps notes isolated per-candidate as required.

/** @type {string|null} Currently viewed coach ID for meeting notes */
let currentMeetingNotesCoachId = null;

/**
 * Opens the Meeting Notes sub-view for a specific coach.
 * Hides the main coach grid and shows the notes view.
 * Loads any existing notes from localStorage.
 *
 * @param {string} coachId - The unique ID of the coach
 */
function openMeetingNotes(coachId) {
    // Find the coach by ID to display their name
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) {
        alert('Coach not found.');
        return;
    }

    // Store the current coach ID for save operations
    currentMeetingNotesCoachId = coachId;

    // Update the view header with coach name
    document.getElementById('meetingNotesCoachName').textContent = coach.name;
    document.getElementById('meetingNotesTitle').textContent = `Meeting Notes - ${coach.name}`;

    // Load existing notes from localStorage (keyed by coach ID)
    const notes = loadMeetingNotesFromStorage(coachId);
    document.getElementById('meetingNotesText').value = notes;

    // Clear any previous status message
    document.getElementById('meetingNotesStatus').textContent = '';
    document.getElementById('meetingNotesStatus').classList.remove('saved');

    // Hide the main coach grid, show the notes view
    document.getElementById('coachMainView').style.display = 'none';
    document.getElementById('meetingNotesView').style.display = 'block';

    // Focus the textarea for immediate typing
    document.getElementById('meetingNotesText').focus();
}

/**
 * Closes the Meeting Notes sub-view and returns to the coach grid.
 * Does not auto-save - user should explicitly save before leaving.
 */
function closeMeetingNotes() {
    // Hide the notes view, show the main coach grid
    document.getElementById('meetingNotesView').style.display = 'none';
    document.getElementById('coachMainView').style.display = 'block';

    // Clear the current coach ID
    currentMeetingNotesCoachId = null;
}

/**
 * Saves the meeting notes to localStorage.
 * Notes are stored with a key format: 'meetingNotes_{coachId}'
 * This ensures each coach's notes are stored separately.
 */
function saveMeetingNotes() {
    if (!currentMeetingNotesCoachId) {
        alert('No coach selected.');
        return;
    }

    const notes = document.getElementById('meetingNotesText').value;

    // Save to localStorage with coach-specific key
    // Key format: meetingNotes_{coachId}
    const storageKey = `meetingNotes_${currentMeetingNotesCoachId}`;
    localStorage.setItem(storageKey, notes);

    // Show saved confirmation
    const statusEl = document.getElementById('meetingNotesStatus');
    statusEl.textContent = 'Notes saved successfully!';
    statusEl.classList.add('saved');

    // Clear the status after 3 seconds
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.classList.remove('saved');
    }, 3000);
}

/**
 * Loads meeting notes from localStorage for a specific coach.
 * Returns empty string if no notes exist.
 *
 * @param {string} coachId - The unique ID of the coach
 * @returns {string} The stored notes or empty string
 */
function loadMeetingNotesFromStorage(coachId) {
    // Retrieve notes using coach-specific key
    const storageKey = `meetingNotes_${coachId}`;
    return localStorage.getItem(storageKey) || '';
}

/**
 * Deletes meeting notes from localStorage for a specific coach.
 * Called when a coach is deleted to clean up orphaned notes.
 *
 * @param {string} coachId - The unique ID of the coach
 */
function deleteMeetingNotesFromStorage(coachId) {
    const storageKey = `meetingNotes_${coachId}`;
    localStorage.removeItem(storageKey);
}

// ============================================
// Outlook Calendar Integration
// ============================================
// Opens Outlook Web calendar focused on a specific date and time.
// This approach doesn't require API authentication or event IDs.
// It uses Outlook's deep link URL format to open the calendar view.

/**
 * Opens Microsoft Outlook calendar in a new tab, focused on the meeting date/time.
 *
 * How it works:
 * - Uses Outlook Web's deep link format: outlook.office.com/calendar/view/day
 * - The 'date' parameter sets which day to display (YYYY-MM-DD format)
 * - Since Outlook Web doesn't have a direct 'time' URL parameter for day view,
 *   we open the day view which will show all events for that day
 *
 * Why this approach:
 * - No Outlook API authentication required
 * - No event ID needed (we may not have created the event via API)
 * - Works with any Outlook account (personal, work, school)
 * - Fallback-safe: if user isn't logged in, Outlook will prompt for login
 * - Browser handles whether to open Outlook Web or desktop app
 *
 * @param {string} meetingDate - The meeting date in YYYY-MM-DD format
 * @param {string} meetingTime - The meeting time in HH:MM format (optional)
 */
function openOutlookCalendar(meetingDate, meetingTime) {
    // Validate that we have a date
    if (!meetingDate) {
        console.warn('No meeting date provided');
        return;
    }

    // Build the Outlook Web calendar URL
    // Format: https://outlook.office.com/calendar/view/day/YYYY/MM/DD
    // This opens the day view for the specified date

    // Parse the date to get year, month, day
    const dateParts = meetingDate.split('-');
    if (dateParts.length !== 3) {
        console.warn('Invalid date format:', meetingDate);
        return;
    }

    const [year, month, day] = dateParts;

    // Outlook Web calendar deep link - opens day view for the specified date
    // This is the most reliable cross-platform approach without event IDs
    const outlookUrl = `https://outlook.office.com/calendar/view/day/${year}/${month}/${day}`;

    // Open in a new tab/window
    // The browser will handle whether to open Outlook Web or prompt for the desktop app
    window.open(outlookUrl, '_blank', 'noopener,noreferrer');

    // Log for debugging (can be removed in production)
    console.log(`Opening Outlook calendar for ${meetingDate} ${meetingTime || ''}`);
}

// ============================================
// Smart Import Feature
// ============================================

/**
 * Opens the smart import modal.
 */
function openImportModal() {
    document.getElementById('importText').value = '';
    document.getElementById('importType').value = 'auto';
    document.getElementById('parseResults').innerHTML = '';
    document.getElementById('importModal').classList.add('show');
    document.getElementById('importText').focus();
}

/**
 * Closes the smart import modal.
 */
function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
}

/**
 * Parses the import text and displays results.
 */
function parseImportText() {
    const text = document.getElementById('importText').value;
    const type = document.getElementById('importType').value;

    if (!text.trim()) {
        alert('Please paste some text first.');
        return;
    }

    const results = parseText(text, type);
    displayParseResults(results);
}

/**
 * Parses text to extract job or coach information.
 * @param {string} text - The text to parse
 * @param {string} forceType - Force a specific type ('job', 'coach', or 'auto')
 * @returns {Array} Array of parsed results
 */
function parseText(text, forceType) {
    const results = [];
    const fullText = text.toLowerCase();

    // Auto-detect type based on keywords
    let type = forceType;
    if (type === 'auto') {
        const coachKeywords = ['coach', 'coaching', 'career coach', 'consultation', 'session'];
        const jobKeywords = ['interview', 'application', 'position', 'role', 'hiring', 'recruiter', 'job'];
        const coachScore = coachKeywords.filter(k => fullText.includes(k)).length;
        const jobScore = jobKeywords.filter(k => fullText.includes(k)).length;
        type = coachScore > jobScore ? 'coach' : 'job';
    }

    // Extract data using patterns
    const data = {
        type,
        company: extractCompany(text),
        role: extractRole(text),
        name: extractName(text),
        email: extractEmail(text),
        phone: extractPhone(text),
        date: extractDate(text),
        time: extractTime(text),
        price: extractPrice(text),
        notes: text.substring(0, 500)
    };

    results.push(data);
    return results;
}

/**
 * Extracts a company name from text.
 * @param {string} text - Text to search
 * @returns {string} Extracted company name or empty string
 */
function extractCompany(text) {
    const patterns = [
        /(?:at|@|with)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s+for|\s+regarding|,|\.|$)/i,
        /([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3})\s+(?:is hiring|interview|position)/i,
        /(?:company|employer|firm):\s*([^\n,]+)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return '';
}

/**
 * Extracts a job role/title from text.
 * @param {string} text - Text to search
 * @returns {string} Extracted role or empty string
 */
function extractRole(text) {
    const patterns = [
        /(?:role|position|title|job):\s*([^\n]+)/i,
        /(?:for the|for a)\s+([A-Z][A-Za-z\s]+?)(?:\s+position|\s+role|\s+at|,|\.|$)/i,
        /((?:Senior|Junior|Lead|Staff|Principal)?\s*(?:Software|Sales|Marketing|Product|Account|Business)\s*(?:Engineer|Developer|Manager|Executive|Representative|SDR|AE|BDR)[A-Za-z\s]*)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return '';
}

/**
 * Extracts a person's name from text.
 * @param {string} text - Text to search
 * @returns {string} Extracted name or empty string
 */
function extractName(text) {
    const patterns = [
        /(?:with|meet|meeting|from|coach|by)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
        /(?:Hi|Hello|Dear)\s+([A-Z][a-z]+)/,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+will|\s+would|\s+is|\s+has)/
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1].trim();
    }
    return '';
}

/**
 * Extracts an email address from text.
 * @param {string} text - Text to search
 * @returns {string} Extracted email or empty string
 */
function extractEmail(text) {
    const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return m ? m[0] : '';
}

/**
 * Extracts a phone number from text.
 * @param {string} text - Text to search
 * @returns {string} Extracted phone or empty string
 */
function extractPhone(text) {
    const m = text.match(/(?:\+1\s?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/);
    return m ? m[0] : '';
}

/**
 * Extracts a date from text.
 * @param {string} text - Text to search
 * @returns {string} Date in YYYY-MM-DD format or empty string
 */
function extractDate(text) {
    const now = new Date();
    const year = now.getFullYear();

    const patterns = [
        /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
        /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.,]?\s+(\d{1,2})(?:st|nd|rd|th)?(?:[.,]?\s+(\d{4}))?/i,
        /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,]?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.,]?\s+(\d{1,2})/i
    ];

    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            try {
                const dateStr = m[0];
                const parsed = new Date(dateStr + (dateStr.includes(year.toString()) ? '' : ` ${year}`));
                if (!isNaN(parsed)) {
                    return parsed.toISOString().split('T')[0];
                }
            } catch (e) {
                // Continue to next pattern
            }
        }
    }
    return '';
}

/**
 * Extracts a time from text.
 * @param {string} text - Text to search
 * @returns {string} Time in HH:MM format or empty string
 */
function extractTime(text) {
    const patterns = [
        /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i,
        /(\d{1,2})\s*(AM|PM|am|pm)/i
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) {
            let hour = parseInt(m[1]);
            const min = m[2]?.length === 2 ? m[2] : '00';
            const ampm = (m[3] || m[2]).toUpperCase();
            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            return `${hour.toString().padStart(2, '0')}:${min}`;
        }
    }
    return '';
}

/**
 * Extracts a price from text.
 * @param {string} text - Text to search
 * @returns {string} Extracted price or empty string
 */
function extractPrice(text) {
    const m = text.match(/\$\s*\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*\/\s*(?:hr|hour|session|month|mo))?/i);
    return m ? m[0] : '';
}

/**
 * Displays the parsed results in the import modal.
 * @param {Array} results - Array of parsed results
 */
function displayParseResults(results) {
    const container = document.getElementById('parseResults');

    if (results.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Could not parse any items. Try adding manually.</p>';
        return;
    }

    container.innerHTML = `
        <div class="parse-results">
            <h4>Extracted Information</h4>
            ${results.map((r, i) => `
                <div class="parse-item">
                    <div class="parse-item-header">
                        <span class="parse-item-title">${escapeHtml(r.type === 'job' ? (r.company || 'Job Application') : (r.name || 'Coach'))}</span>
                        <span class="parse-item-type ${r.type}">${r.type === 'job' ? 'Job' : 'Coach'}</span>
                    </div>
                    <div class="parse-item-details">
                        ${r.type === 'job' ? `
                            ${r.company ? `<p><strong>Company:</strong> ${escapeHtml(r.company)}</p>` : ''}
                            ${r.role ? `<p><strong>Role:</strong> ${escapeHtml(r.role)}</p>` : ''}
                            ${r.date ? `<p><strong>Interview Date:</strong> ${r.date}</p>` : ''}
                            ${r.time ? `<p><strong>Time:</strong> ${formatTime(r.time)}</p>` : ''}
                            ${r.email ? `<p><strong>Contact:</strong> ${escapeHtml(r.email)}</p>` : ''}
                        ` : `
                            ${r.name ? `<p><strong>Name:</strong> ${escapeHtml(r.name)}</p>` : ''}
                            ${r.price ? `<p><strong>Price:</strong> ${escapeHtml(r.price)}</p>` : ''}
                            ${r.date ? `<p><strong>Meeting Date:</strong> ${r.date}</p>` : ''}
                            ${r.time ? `<p><strong>Time:</strong> ${formatTime(r.time)}</p>` : ''}
                            ${r.email ? `<p><strong>Email:</strong> ${escapeHtml(r.email)}</p>` : ''}
                        `}
                    </div>
                    <div class="parse-actions">
                        <button class="btn btn-primary btn-sm" onclick="addParsedItem(${i})">Add ${r.type === 'job' ? 'Job' : 'Coach'}</button>
                        <button class="btn btn-secondary btn-sm" onclick="editParsedItem(${i})">Edit First</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Store results for later use
    window.parsedResults = results;
}

/**
 * Adds a parsed item directly to the data.
 * @param {number} index - Index of the parsed result
 */
function addParsedItem(index) {
    const r = window.parsedResults[index];

    if (r.type === 'job') {
        const job = {
            id: generateId(),
            company: r.company || 'Unknown Company',
            role: r.role || 'Position',
            address: '',
            companyWebsite: '',
            salary: '',
            dateApplied: new Date().toISOString().split('T')[0],
            // Always start in Company Pipeline
            stage: 'pipeline',
            interviewDate: r.date || '',
            interviewTime: r.time || '',
            contactName: r.name || '',
            contactInfo: r.email || r.phone || '',
            tags: [],
            notes: r.notes || '',
            tasks: []
        };
        jobs.push(job);
        saveData();
    } else {
        const coach = {
            id: generateId(),
            name: r.name || 'Job Coach',
            specialty: '',
            price: r.price || '',
            rating: null,
            email: r.email || '',
            phone: r.phone || '',
            website: '',
            meetingDate: r.date || '',
            meetingTime: r.time || '',
            status: r.date ? 'consulting' : 'contacted',
            notes: r.notes || ''
        };
        coaches.push(coach);
        saveCoachData();
    }

    closeImportModal();
    alert(`${r.type === 'job' ? 'Job' : 'Coach'} added successfully!`);
}

/**
 * Opens the appropriate modal with pre-filled parsed data for editing.
 * @param {number} index - Index of the parsed result
 */
function editParsedItem(index) {
    const r = window.parsedResults[index];
    closeImportModal();

    if (r.type === 'job') {
        openAddModal();
        setTimeout(() => {
            document.getElementById('company').value = r.company || '';
            document.getElementById('role').value = r.role || '';
            document.getElementById('interviewDate').value = r.date || '';
            document.getElementById('interviewTime').value = r.time || '';
            document.getElementById('contactName').value = r.name || '';
            document.getElementById('contactInfo').value = r.email || r.phone || '';
            document.getElementById('notes').value = r.notes || '';
            document.getElementById('stage').value = 'pipeline';
        }, 100);
    } else {
        openCoachModal();
        setTimeout(() => {
            document.getElementById('coachName').value = r.name || '';
            document.getElementById('coachPrice').value = r.price || '';
            document.getElementById('coachEmail').value = r.email || '';
            document.getElementById('coachPhone').value = r.phone || '';
            document.getElementById('coachMeetingDate').value = r.date || '';
            document.getElementById('coachMeetingTime').value = r.time || '';
            document.getElementById('coachNotes').value = r.notes || '';
            if (r.date) document.getElementById('coachStatus').value = 'consulting';
        }, 100);
    }
}

// ============================================
// Tab Navigation
// ============================================

/**
 * Switches between the Jobs and Coach tabs.
 * @param {string} tab - The tab to switch to ('jobs' or 'coach')
 */
function switchTab(tab) {
    currentTab = tab;

    // Update tab button styles
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', (tab === 'jobs' && i === 0) || (tab === 'coach' && i === 1));
    });

    // Update tab content visibility
    document.getElementById('tab-jobs').classList.toggle('active', tab === 'jobs');
    document.getElementById('tab-coach').classList.toggle('active', tab === 'coach');

    // Update the main add button
    const addBtn = document.getElementById('mainAddBtn');
    addBtn.textContent = tab === 'jobs' ? '+ Add Job' : '+ Add Coach';
    addBtn.onclick = tab === 'jobs' ? openAddModal : openCoachModal;
}

// ============================================
// Confirmation Modal
// ============================================

/**
 * Opens a confirmation modal.
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} callback - Function to call when confirmed
 */
function openConfirmModal(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmModal').classList.add('show');
}

/**
 * Closes the confirmation modal.
 */
function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
}

/**
 * Executes the confirmation callback and closes the modal.
 */
function confirmAction() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

/**
 * Shows confirmation dialog for deleting a job.
 * @param {string} jobId - The ID of the job to delete
 */
function confirmDeleteJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    openConfirmModal('Delete Job', `Delete ${job.company}?`, () => {
        jobs = jobs.filter(j => j.id !== jobId);
        saveData();
    });
}

/**
 * Shows confirmation dialog for deleting a coach.
 * @param {string} coachId - The ID of the coach to delete
 */
function confirmDeleteCoach(coachId) {
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) return;
    openConfirmModal('Delete Coach', `Delete ${coach.name}?`, () => {
        coaches = coaches.filter(c => c.id !== coachId);
        // Also delete any meeting notes associated with this coach
        deleteMeetingNotesFromStorage(coachId);
        saveCoachData();
    });
}

/**
 * Shows confirmation dialog for clearing all data.
 */
function confirmClearAll() {
    const total = jobs.length + coaches.length;
    if (total === 0) {
        alert('Nothing to clear.');
        return;
    }
    openConfirmModal('Clear All', `Delete ${jobs.length} jobs and ${coaches.length} coaches?`, () => {
        jobs = [];
        coaches = [];
        localStorage.removeItem('jobTrackerData');
        localStorage.removeItem('jobTrackerCoaches');
        renderAll();
    });
}

// ============================================
// Data Export
// ============================================

/**
 * Exports all data as a JSON file download.
 */
function exportData() {
    const data = JSON.stringify({ jobs, coaches }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Event Listeners
// ============================================

// Close modals on Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal();
        closeCoachModal();
        closeImportModal();
        closeConfirmModal();
    }
});

// Close modals when clicking outside
['jobModal', 'coachModal', 'importModal', 'confirmModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
        if (e.target === this) {
            if (id === 'jobModal') closeModal();
            else if (id === 'coachModal') closeCoachModal();
            else if (id === 'importModal') closeImportModal();
            else closeConfirmModal();
        }
    });
});

// Handle Enter key in task input
document.getElementById('newTask').addEventListener('keypress', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addTask();
    }
});

// ============================================
// Initialize App
// ============================================
init();
