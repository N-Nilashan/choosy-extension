// AI Comment Generator - Content Script
// Handles UI injection and comment generation for LinkedIn and Twitter/X

class CommentGenerator {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.initialized = false;
    this.initialize();
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    await this.setupStyles();
    this.createFloatingBar();
    this.setupMutationObserver();
    this.addEventListeners();
    await this.checkApiKey();

    // Initial check for comment box in case page loaded before extension
    setTimeout(() => this.checkForCommentBox(), 1000);
  }

  async setupStyles() {
    return new Promise((resolve) => {
      if (!document.getElementById('ai-comment-generator-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-comment-generator-styles';
        style.textContent = `
          #ai-comment-generator-bar {
            position: fixed;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 99999;
            display: flex;
            gap: 8px;
            align-items: center;
            transition: all 0.3s ease;
          }

          #ai-comment-generator-bar.hidden {
            opacity: 0;
            pointer-events: none;
            transform: translateY(10px);
          }

          #ai-tone-select {
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid #ccc;
            min-width: 100px;
            background: white;
          }

          #ai-generate-btn, #ai-clear-btn {
            padding: 6px 12px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.2s;
          }

          #ai-generate-btn {
            background-color: #4CAF50;
            color: white;
          }

          #ai-generate-btn:hover {
            background-color: #45a049;
          }

          #ai-generate-btn:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
          }

          #ai-clear-btn {
            background-color: #f44336;
            color: white;
          }

          #ai-clear-btn:hover {
            background-color: #d32f2f;
          }

          #ai-status-message {
            position: absolute;
            bottom: -25px;
            left: 0;
            width: 100%;
            text-align: center;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .error { color: #d32f2f; }
          .success { color: #4CAF50; }
          .info { color: #1976D2; }
        `;
        document.head.appendChild(style);
      }
      resolve();
    });
  }

  createFloatingBar() {
    // Remove existing bar if present
    const existingBar = document.getElementById('ai-comment-generator-bar');
    if (existingBar) {
      existingBar.remove();
    }

    this.floatingBar = document.createElement('div');
    this.floatingBar.id = 'ai-comment-generator-bar';
    this.floatingBar.className = 'hidden';

    // Tone selection dropdown
    this.toneSelect = document.createElement('select');
    this.toneSelect.id = 'ai-tone-select';

    const tones = [
      { value: 'professional', label: 'Professional' },
      { value: 'friendly', label: 'Friendly' },
      { value: 'funny', label: 'Funny' },
      { value: 'supportive', label: 'Supportive' },
      { value: 'analytical', label: 'Analytical' }
    ];

    tones.forEach(tone => {
      const option = document.createElement('option');
      option.value = tone.value;
      option.textContent = tone.label;
      this.toneSelect.appendChild(option);
    });

    // Action buttons
    this.generateBtn = document.createElement('button');
    this.generateBtn.id = 'ai-generate-btn';
    this.generateBtn.textContent = 'GENERATE';

    this.clearBtn = document.createElement('button');
    this.clearBtn.id = 'ai-clear-btn';
    this.clearBtn.textContent = 'CLEAR';

    // Status message element
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'ai-status-message';

    // Assemble the UI
    this.floatingBar.appendChild(this.toneSelect);
    this.floatingBar.appendChild(this.generateBtn);
    this.floatingBar.appendChild(this.clearBtn);
    this.floatingBar.appendChild(this.statusElement);

    document.body.appendChild(this.floatingBar);
  }

  addEventListeners() {
    // Remove existing listeners to prevent duplicates
    this.generateBtn?.removeEventListener('click', this.handleGenerateClickBound);
    this.clearBtn?.removeEventListener('click', this.clearCommentBoxBound);

    // Create bound versions of methods for event listeners
    this.handleGenerateClickBound = this.handleGenerateClick.bind(this);
    this.clearCommentBoxBound = this.clearCommentBox.bind(this);

    // Add event listeners
    this.generateBtn?.addEventListener('click', this.handleGenerateClickBound);
    this.clearBtn?.addEventListener('click', this.clearCommentBoxBound);

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter' && this.floatingBar && !this.floatingBar.classList.contains('hidden')) {
        this.handleGenerateClick();
      }
    });
  }

  async handleGenerateClick() {
    try {
      this.showLoading(true);
      this.showStatus('Generating comment...', 'info');

      const commentBox = this.findCommentBox();
      if (!commentBox) {
        throw new Error('Could not find comment box');
      }

      const postText = this.getPostText();
      if (!postText || postText.trim().length < 5) {
        throw new Error('Post text is too short to generate a meaningful response');
      }

      const tone = this.toneSelect.value;
      const response = await this.generateAICommentWithRetry(postText, tone);

      if (response.error) {
        throw new Error(response.error);
      }

      this.insertGeneratedText(commentBox, response.generatedText);
      this.showStatus('Comment generated!', 'success');
      this.retryCount = 0;
    } catch (error) {
      console.error('Comment generation error:', error);
      this.showStatus(this.getUserFriendlyError(error), 'error');

      if (this.isRetryableError(error) && this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.handleGenerateClick(), 2000 * this.retryCount);
      }
    } finally {
      this.showLoading(false);
    }
  }

  async generateAICommentWithRetry(postText, tone) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'generateComment',
            postText: postText,
            tone: tone
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (response?.error) {
              reject(new Error(response.error));
              return;
            }
            resolve(response);
          }
        );
      });
    } catch (error) {
      throw error;
    }
  }

  isRetryableError(error) {
    return error.message.includes('Failed to fetch') ||
           error.message.includes('NetworkError') ||
           error.message.includes('timeout');
  }

  getUserFriendlyError(error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Network error - please check your connection';
    }
    if (error.message.includes('API key')) {
      return 'Invalid API key - please check settings';
    }
    if (error.message.includes('rate limit')) {
      return 'API limit reached - please wait a moment';
    }
    return error.message || 'Failed to generate comment';
  }

  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          this.checkForCommentBox();
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  checkForCommentBox() {
    const commentBox = this.findCommentBox();
    if (commentBox) {
      this.positionFloatingBar(commentBox);
    }
  }

  positionFloatingBar(commentBox) {
    if (!commentBox || !this.floatingBar) return;

    const rect = commentBox.getBoundingClientRect();
    const isTwitter = window.location.hostname.includes('twitter.com') ||
                      window.location.hostname.includes('x.com');

    // Adjust positioning based on platform
    if (isTwitter) {
      this.floatingBar.style.top = `${window.scrollY + rect.top - 50}px`;
      this.floatingBar.style.left = `${rect.left}px`;
    } else { // LinkedIn
      this.floatingBar.style.top = `${window.scrollY + rect.top - 45}px`;
      this.floatingBar.style.left = `${rect.left + rect.width - 350}px`;
    }

    this.floatingBar.classList.remove('hidden');
  }

  findCommentBox() {
    const selectors = [
      // LinkedIn
      'div.comments-comment-box__editor div.ql-editor',
      'div.feed-shared-comment-box div[role="textbox"]',
      'div[data-control-name="comment_text_input"] textarea',
      'div.msg-form__contenteditable[role="textbox"]',

      // Twitter/X
      'div[data-testid="tweetTextarea_0"]',
      'div[data-testid="reply"] div.public-DraftEditor-content',
      'div[contenteditable="true"][data-testid*="tweetTextarea"]',

      // Fallbacks
      'div[role="textbox"][contenteditable="true"]',
      'textarea[aria-label*="comment"], textarea[placeholder*="comment"]',
      'div[contenteditable="true"][aria-label*="comment"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.isVisible(element)) {
        return element;
      }
    }
    return null;
  }

  isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  }

  getPostText() {
    const selectors = [
      // LinkedIn post text
      '.feed-shared-update-v2__description-wrapper .break-words',
      '.update-components-text .break-words',

      // Twitter/X tweet text
      'article[data-testid="tweet"] div[data-testid="tweetText"]',
      'div[data-testid="tweetText"]',

      // Fallbacks
      '[aria-label="Tweet text"]',
      '[aria-label="Post text"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.isVisible(element)) {
        return element.textContent.trim().replace(/\s+/g, ' ');
      }
    }
    return '';
  }

  insertGeneratedText(commentBox, text) {
    if (!commentBox || !text) return;

    if (commentBox.tagName === 'TEXTAREA') {
      commentBox.value = text;
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (commentBox.isContentEditable) {
      commentBox.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    }
  }

  clearCommentBox() {
    const commentBox = this.findCommentBox();
    if (commentBox) {
      if (commentBox.tagName === 'TEXTAREA') {
        commentBox.value = '';
      } else if (commentBox.isContentEditable) {
        commentBox.innerHTML = '';
      }
      this.showStatus('Comment cleared', 'info');
    }
  }

  showLoading(isLoading) {
    if (this.generateBtn) {
      this.generateBtn.disabled = isLoading;
      this.generateBtn.textContent = isLoading ? 'Generating...' : 'GENERATE';
    }
  }

  showStatus(message, type = 'info') {
    if (!this.statusElement) return;

    this.statusElement.textContent = message;
    this.statusElement.className = type;

    if (type !== 'error') {
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.textContent = '';
        }
      }, 3000);
    }
  }

  async checkApiKey() {
    try {
      const { openRouterApiKey } = await chrome.storage.local.get(['openRouterApiKey']);
      if (!openRouterApiKey) {
        this.showStatus('Please set your API key in extension settings', 'error');
      }
    } catch (error) {
      console.error('Error checking API key:', error);
    }
  }
}

// Initialize on supported platforms
const supportedPlatforms = ['linkedin.com', 'twitter.com', 'x.com'];
if (supportedPlatforms.some(platform => window.location.hostname.includes(platform))) {
  // Handle both DOMContentLoaded and complete states
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new CommentGenerator();
    });
  } else {
    new CommentGenerator();
  }
}
