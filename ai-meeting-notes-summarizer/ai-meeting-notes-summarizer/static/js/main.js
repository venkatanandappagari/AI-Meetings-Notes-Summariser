// Global variables
let currentNoteId = null;
let originalSummary = '';
let isEditing = false;
let emailConfigured = false;

// DOM elements
const uploadForm = document.getElementById('uploadForm');
const loadingSpinner = document.getElementById('loadingSpinner');
const summarySection = document.getElementById('summarySection');
const emailSection = document.getElementById('emailSection');
const summaryDisplay = document.getElementById('summaryDisplay');
const summaryEditor = document.getElementById('summaryEditor');
const editBtn = document.getElementById('editBtn');
const editControls = document.getElementById('editControls');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const emailForm = document.getElementById('emailForm');
const alertContainer = document.getElementById('alertContainer');
const generateBtn = document.getElementById('generateBtn');
const sendEmailBtn = document.getElementById('sendEmailBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectedFileName = document.getElementById('selectedFileName');
const fileName = document.getElementById('fileName');

// Event listeners
uploadForm.addEventListener('submit', handleUpload);
editBtn.addEventListener('click', toggleEdit);
saveBtn.addEventListener('click', saveSummary);
cancelBtn.addEventListener('click', cancelEdit);
emailForm.addEventListener('submit', sendEmail);

// Drag and drop event listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);

// Upload handler
async function handleUpload(e) {
    e.preventDefault();
    
    const customPrompt = document.getElementById('customPrompt').value.trim();
    
    // Validation
    if (!fileInput.files[0]) {
        showAlert('Please select a file', 'danger');
        return;
    }
    
    if (!customPrompt) {
        showAlert('Please provide custom instructions', 'danger');
        return;
    }
    
    // Show loading
    showLoading(true);
    generateBtn.disabled = true;
    
    // Prepare form data
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('custom_prompt', customPrompt);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            currentNoteId = result.note_id;
            originalSummary = result.summary;
            displaySummary(result.summary);
            showAlert('Summary generated successfully!', 'success');
        } else {
            showAlert(result.error || 'Failed to generate summary', 'danger');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'danger');
        console.error('Upload error:', error);
    } finally {
        showLoading(false);
        generateBtn.disabled = false;
    }
}

// Display summary
function displaySummary(summary) {
    summaryDisplay.innerHTML = formatSummary(summary);
    summaryEditor.value = summary;
    summarySection.style.display = 'block';
    emailSection.style.display = 'block';
    
    // Check email configuration when email section becomes visible
    checkEmailConfiguration();
}

// Format summary for display
function formatSummary(summary) {
    return summary.replace(/\n/g, '<br>');
}

// Toggle edit mode
function toggleEdit() {
    if (isEditing) {
        cancelEdit();
    } else {
        startEdit();
    }
}

// Start editing
function startEdit() {
    isEditing = true;
    summaryDisplay.style.display = 'none';
    summaryEditor.style.display = 'block';
    editControls.style.display = 'block';
    editBtn.innerHTML = '<i class="fas fa-times me-1"></i>Cancel';
    editBtn.classList.remove('btn-outline-secondary');
    editBtn.classList.add('btn-outline-danger');
}

// Cancel editing
function cancelEdit() {
    isEditing = false;
    summaryEditor.value = originalSummary;
    summaryDisplay.style.display = 'block';
    summaryEditor.style.display = 'none';
    editControls.style.display = 'none';
    editBtn.innerHTML = '<i class="fas fa-edit me-1"></i>Edit';
    editBtn.classList.remove('btn-outline-danger');
    editBtn.classList.add('btn-outline-secondary');
}

// Save summary
async function saveSummary() {
    const editedSummary = summaryEditor.value.trim();
    
    if (!editedSummary) {
        showAlert('Summary cannot be empty', 'danger');
        return;
    }
    
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(`/update_summary/${currentNoteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ summary: editedSummary })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            originalSummary = editedSummary;
            summaryDisplay.innerHTML = formatSummary(editedSummary);
            cancelEdit();
            showAlert('Summary updated successfully!', 'success');
        } else {
            showAlert(result.error || 'Failed to update summary', 'danger');
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'danger');
        console.error('Save error:', error);
    } finally {
        saveBtn.disabled = false;
    }
}

// Check email configuration
async function checkEmailConfiguration() {
    try {
        const response = await fetch('/check_email_config');
        const result = await response.json();
        
        emailConfigured = result.configured;
        
        if (!emailConfigured) {
            showEmailConfigurationWarning();
        } else {
            hideEmailConfigurationWarning();
        }
    } catch (error) {
        console.error('Failed to check email configuration:', error);
    }
}

// Show email configuration warning
function showEmailConfigurationWarning() {
    const warningHtml = `
        <div class="alert alert-warning" id="emailConfigWarning">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Email service not configured:</strong> Email credentials are missing. 
            You can still generate and edit summaries, but email sharing is unavailable.
        </div>
    `;
    
    // Insert warning before the email form
    const emailCard = emailSection.querySelector('.card-body');
    if (!document.getElementById('emailConfigWarning')) {
        emailCard.insertAdjacentHTML('afterbegin', warningHtml);
    }
    
    // Disable email form
    sendEmailBtn.disabled = true;
    sendEmailBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>Email Service Unavailable';
    document.getElementById('emailAddresses').disabled = true;
}

// Hide email configuration warning
function hideEmailConfigurationWarning() {
    const warning = document.getElementById('emailConfigWarning');
    if (warning) {
        warning.remove();
    }
    
    // Enable email form
    sendEmailBtn.disabled = false;
    sendEmailBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Send Email';
    document.getElementById('emailAddresses').disabled = false;
}

// Send email
async function sendEmail(e) {
    e.preventDefault();
    
    if (!emailConfigured) {
        showAlert('Email service is not configured. Please contact the administrator.', 'warning');
        return;
    }
    
    const emailAddresses = document.getElementById('emailAddresses').value.trim();
    
    if (!emailAddresses) {
        showAlert('Please enter at least one email address', 'danger');
        return;
    }
    
    // Parse email addresses
    const emails = emailAddresses
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email.length > 0);
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
        showAlert(`Invalid email addresses: ${invalidEmails.join(', ')}`, 'danger');
        return;
    }
    
    sendEmailBtn.disabled = true;
    sendEmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
    
    try {
        const response = await fetch(`/send_email/${currentNoteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ emails: emails })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showAlert(`Email sent successfully to ${emails.length} recipient(s)!`, 'success');
            document.getElementById('emailAddresses').value = '';
        } else {
            // Handle different types of errors
            if (result.error_type === 'configuration') {
                showAlert(result.error, 'warning');
                emailConfigured = false;
                showEmailConfigurationWarning();
            } else {
                showAlert(result.error || 'Failed to send email', 'danger');
            }
        }
    } catch (error) {
        showAlert('Network error. Please try again.', 'danger');
        console.error('Email error:', error);
    } finally {
        if (emailConfigured) {
            sendEmailBtn.disabled = false;
            sendEmailBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Send Email';
        }
    }
}

// Show loading spinner
function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    if (show) {
        summarySection.style.display = 'none';
        emailSection.style.display = 'none';
    }
}

// Show alert message
function showAlert(message, type) {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="fas fa-${getAlertIcon(type)} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.innerHTML = alertHtml;
    
    // Auto-dismiss success alerts after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            const alert = alertContainer.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }
}

// Get alert icon based on type
function getAlertIcon(type) {
    const icons = {
        'success': 'check-circle',
        'danger': 'exclamation-triangle',
        'warning': 'exclamation-circle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileValidation(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFileValidation(file);
    }
}

// File validation and display
function handleFileValidation(file) {
    // Reset previous selections
    selectedFileName.style.display = 'none';
    
    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith('.txt') && !fileNameLower.endsWith('.pdf')) {
        showAlert('Please select a .txt or .pdf file', 'danger');
        fileInput.value = '';
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) { // 16MB
        showAlert('File size must be less than 16MB', 'danger');
        fileInput.value = '';
        return;
    }
    
    // Create a file list and assign to input
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    
    // Show selected file name
    fileName.textContent = file.name;
    selectedFileName.style.display = 'block';
}
