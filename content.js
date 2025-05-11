// ChoosyAI Content Script
// Handles the floating bar UI and comment generation logic

// Configuration
const CONFIG = {
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  MODEL: 'mistralai/mistral-small-3.1-24b-instruct:free',
  MAX_TOKENS: 150,
  TEMPERATURE: {
    professional: 0.5,
    friendly: 0.5,
    funny: 0.7
  },
  PLATFORMS: {
    LINKEDIN: {
      name: 'LinkedIn',
      commentSelectors: [
        '.ql-editor',
        '.msg-form__contenteditable',
        'div[contenteditable="true"][role="textbox"]'
      ],
      postSelectors: [
        '.feed-shared-update-v2__description',
        '.feed-shared-text',
        '[data-id^="urn:li:activity"] .break-words'
      ],
      maxLength: 1000 // Rough estimate for LinkedIn comments
    },
    TWITTER: {
      name: 'Twitter/X',
      commentSelectors: [
        '[data-testid="tweetTextarea_0"]',
        '[role="textbox"][aria-label="Post text"]',
        '[contenteditable="true"][role="textbox"]'
      ],
      postSelectors: [
        '[data-testid="tweetText"]',
        'article [lang]',
        '[role="article"] [lang]'
      ],
      maxLength: 280
    }
  }
};

// Global variables
let currentPlatform = null;
let currentCommentBox = null;
let floatingBar = null;
let selectedTone = 'professional';
let apiKey = null;
let isLoading = false;

// Initialize the extension
function init() {
  detectPlatform();
  loadApiKey();
  setupEventListeners();
}

// Detect which platform we're on
function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('linkedin.com')) {
    currentPlatform = CONFIG.PLATFORMS.LINKEDIN;
  } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    currentPlatform = CONFIG.PLATFORMS.TWITTER;
  }
}

// Load API key from storage
function loadApiKey() {
  chrome.storage.sync.get(['apiKey'], (result) => {
    apiKey = result.apiKey;
    console.log('ChoosyAI: API key loaded', apiKey ? '***' : 'not found');
  });
}

// Setup event listeners for comment box focus
function setupEventListeners() {
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('scroll', debounce(handleScrollResize, 100), true);
  window.addEventListener('resize', debounce(handleScrollResize, 100));
}

// Handle focus on comment boxes
function handleFocusIn(event) {
  if (!currentPlatform) return;

  const target = event.target;
  const isCommentBox = currentPlatform.commentSelectors.some(selector =>
    target.matches(selector) || target.closest(selector)
  );

  if (isCommentBox && !floatingBar) {
    currentCommentBox = target.matches(currentPlatform.commentSelectors.join(',')) ?
      target : target.closest(currentPlatform.commentSelectors.join(','));
    createFloatingBar();
  }
}

// Handle clicks outside the comment box/floating bar
function handleClickOutside(event) {
  if (!floatingBar || !currentCommentBox) return;

  const isClickInsideBar = floatingBar.contains(event.target);
  const isClickInsideCommentBox = currentCommentBox.contains(event.target);

  if (!isClickInsideBar && !isClickInsideCommentBox) {
    removeFloatingBar();
  }
}

// Handle scroll/resize events to reposition the bar
function handleScrollResize() {
  if (floatingBar && currentCommentBox) {
    positionFloatingBar();
  }
}

// Debounce function to limit rapid firing of events
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Create the floating bar UI
function createFloatingBar() {
  if (!currentCommentBox) return;

  // Create the floating bar element
  floatingBar = document.createElement('div');
  floatingBar.id = 'choosy-ai-bar';
  floatingBar.style.cssText = `
    position: absolute;
    z-index: 9999;
    background-color: #f5f5f5;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-family: Arial, sans-serif;
    max-width: 400px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  `;

  // Create tone buttons
  const tones = [
    { id: 'professional', label: 'Professional', color: '#007bff' },
    { id: 'friendly', label: 'Friendly', color: '#6c757d' },
    { id: 'funny', label: 'Funny', color: '#6c757d' }
  ];

  tones.forEach(tone => {
    const button = document.createElement('button');
    button.id = `choosy-tone-${tone.id}`;
    button.textContent = tone.label;
    button.style.cssText = `
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid #ccc;
      background-color: ${tone.id === selectedTone ? tone.color : 'white'};
      color: ${tone.id === selectedTone ? 'white' : '#333'};
      cursor: pointer;
      font-size: 14px;
    `;
    button.addEventListener('click', () => selectTone(tone.id));
    floatingBar.appendChild(button);
  });

  // Create generate button
  const generateBtn = document.createElement('button');
  generateBtn.id = 'choosy-generate';
  generateBtn.textContent = 'Generate';
  generateBtn.style.cssText = `
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid #28a745;
    background-color: #28a745;
    color: white;
    cursor: pointer;
    font-size: 14px;
    margin-left: auto;
  `;
  generateBtn.addEventListener('click', generateComment);
  floatingBar.appendChild(generateBtn);

  // Create clear button
  const clearBtn = document.createElement('button');
  clearBtn.id = 'choosy-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = `
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid #dc3545;
    background-color: #dc3545;
    color: white;
    cursor: pointer;
    font-size: 14px;
  `;
  clearBtn.addEventListener('click', clearComment);
  floatingBar.appendChild(clearBtn);

  // Create loading spinner (initially hidden)
  const spinner = document.createElement('div');
  spinner.id = 'choosy-spinner';
  spinner.style.cssText = `
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: none;
    margin-left: 8px;
  `;
  floatingBar.appendChild(spinner);

  // Add CSS for spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Position and add to DOM
  positionFloatingBar();
  document.body.appendChild(floatingBar);

  // Show warning if no API key
  if (!apiKey) {
    showApiKeyWarning();
  }
}

// Position the floating bar below the comment box
function positionFloatingBar() {
  if (!floatingBar || !currentCommentBox) return;

  const rect = currentCommentBox.getBoundingClientRect();
  floatingBar.style.top = `${window.scrollY + rect.bottom + 8}px`;
  floatingBar.style.left = `${window.scrollX + rect.left}px`;
  floatingBar.style.width = `${Math.min(rect.width, 400)}px`;
}

// Remove the floating bar
function removeFloatingBar() {
  if (floatingBar) {
    floatingBar.remove();
    floatingBar = null;
    currentCommentBox = null;
  }
}

// Select a tone
function selectTone(tone) {
  selectedTone = tone;

  // Update button styles
  document.querySelectorAll('#choosy-ai-bar button[id^="choosy-tone-"]').forEach(button => {
    const buttonTone = button.id.replace('choosy-tone-', '');
    button.style.backgroundColor = buttonTone === tone ?
      (tone === 'professional' ? '#007bff' : tone === 'friendly' ? '#6c757d' : '#6c757d') : 'white';
    button.style.color = buttonTone === tone ? 'white' : '#333';
  });
}

// Show API key warning
function showApiKeyWarning() {
  if (!floatingBar) return;

  const warning = document.createElement('div');
  warning.textContent = 'API key not set. Click here to configure.';
  warning.style.cssText = `
    color: #dc3545;
    font-size: 12px;
    margin-top: 8px;
    cursor: pointer;
    width: 100%;
    text-align: center;
  `;
  warning.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
  });
  floatingBar.appendChild(warning);

  // Remove warning after 5 seconds
  setTimeout(() => {
    if (warning.parentNode) {
      warning.remove();
    }
  }, 5000);
}

// Generate a comment using AI
async function generateComment() {
  if (!currentCommentBox || isLoading) return;

  // Check for API key
  if (!apiKey) {
    showApiKeyWarning();
    return;
  }

  // Show loading state
  isLoading = true;
  const spinner = document.getElementById('choosy-spinner');
  const generateBtn = document.getElementById('choosy-generate');
  if (spinner) spinner.style.display = 'block';
  if (generateBtn) generateBtn.disabled = true;

  try {
    // Get post text
    const postText = getPostText();

    // Generate prompt
    const prompt = `Social media comment generator.
Write a ${selectedTone} comment for ${currentPlatform.name}: ${
  currentPlatform === CONFIG.PLATFORMS.LINKEDIN ?
    'Keep it business-appropriate, 1-2 sentences.' :
    'Keep it concise (<280 characters), 1-2 sentences.'
}
Post: "${postText || 'Generic social media post about an interesting topic'}"
Generate a ${selectedTone} comment:`;

    // Call OpenRouter API
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: CONFIG.MAX_TOKENS,
        temperature: CONFIG.TEMPERATURE[selectedTone]
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const comment = data.choices?.[0]?.message?.content?.trim();

    if (comment) {
      insertComment(comment);
    } else {
      throw new Error('No comment generated');
    }
  } catch (error) {
    console.error('ChoosyAI: Error generating comment:', error);
    insertComment(`Error: Could not generate comment. ${error.message}`);
  } finally {
    // Hide loading state
    isLoading = false;
    if (spinner) spinner.style.display = 'none';
    if (generateBtn) generateBtn.disabled = false;
  }
}

// Get the text of the post being commented on
function getPostText() {
  if (!currentPlatform) return '';

  for (const selector of currentPlatform.postSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }

  return '';
}

// Insert comment into the comment box
function insertComment(comment) {
  if (!currentCommentBox) return;

  // LinkedIn Quill editor handling
  if (currentCommentBox.classList.contains('ql-editor')) {
    currentCommentBox.innerHTML = comment;
    // Trigger input event for Quill
    const event = new Event('input', { bubbles: true });
    currentCommentBox.dispatchEvent(event);
  }
  // Twitter/X contenteditable handling
  else if (currentCommentBox.hasAttribute('contenteditable')) {
    currentCommentBox.textContent = comment;
    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(currentCommentBox);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    // Trigger input event
    const event = new Event('input', { bubbles: true });
    currentCommentBox.dispatchEvent(event);
  }
  // Fallback for other contenteditables
  else {
    currentCommentBox.textContent = comment;
    const event = new Event('change', { bubbles: true });
    currentCommentBox.dispatchEvent(event);
  }
}

// Clear the comment box
function clearComment() {
  if (currentCommentBox) {
    insertComment('');
  }
}

// Initialize the extension when the script loads
init();
