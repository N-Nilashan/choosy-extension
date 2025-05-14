// Configuration
const MODEL = "mistralai/mistral-7b-instruct:free";
const MAX_TOKENS = 300;
const TEMPERATURE = 0.7;
const RPD_LIMIT = 50; // OpenRouter's free tier daily limit

// State management
let isRequestInProgress = false;
let requestsToday = 0;
let lastRequestDate = null;

// Initialize daily counter
chrome.storage.sync.get(['requestCount', 'lastRequestDate'], (result) => {
  const today = new Date().toDateString();
  if (result.lastRequestDate === today) {
    requestsToday = result.requestCount || 0;
  } else {
    requestsToday = 0;
    chrome.storage.sync.set({ lastRequestDate: today });
  }
  lastRequestDate = today;
});

// Observer to detect when comment/reply boxes appear
const observer = new MutationObserver((mutations) => {
  debounceCheckForCommentBoxes();
});

// Start observing the document body for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial check when page loads
document.addEventListener('DOMContentLoaded', checkForCommentBoxes);
window.addEventListener('load', checkForCommentBoxes);

// Debounce function to limit rapid checks
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debounceCheckForCommentBoxes = debounce(checkForCommentBoxes, 100);

function checkForCommentBoxes() {
  // LinkedIn selectors
  const linkedInSelectors = [
    'div.comments-comment-box__editor div.ql-editor',
    'div.feed-shared-comment-box div[role="textbox"]',
    'div[data-control-name="comment_text_input"] textarea',
    'div.msg-form__contenteditable[role="textbox"]'
  ];

  // Twitter/X selector
  const twitterSelectors = [
    'div[data-testid="tweetTextarea_0"]' // Target for reply box on X
  ];

  const fallbackSelectors = [
   // Fallbacks
      'div[role="textbox"][contenteditable="true"]',
      'textarea[aria-label*="comment"], textarea[placeholder*="comment"]',
      'div[contenteditable="true"][aria-label*="comment"]'
  ]

  // Handle LinkedIn comment boxes
  if (window.location.hostname.includes('linkedin')) {
    linkedInSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
          attachReplyBar(element);
          element.dataset.aiReplyAttached = 'true';
        }
      });
    });
  }

   if (window.location.hostname.includes('linkedin')) {
    fallbackSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
          attachReplyBar(element);
          element.dataset.aiReplyAttached = 'true';
        }
      });
    });
  }

  // Handle X reply bar when /status/ is in URL
  if ((window.location.hostname.includes('twitter') || window.location.hostname.includes('x.com')) &&
      window.location.pathname.includes('/status/')) {
    twitterSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(element => {
          if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
            attachReplyBar(element);
            element.dataset.aiReplyAttached = 'true';
          }
        });
      }
    });
  }
}

function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, message: "No API key provided" };
  }

  const cleanedKey = apiKey.trim();
  if (!cleanedKey.startsWith('sk-or-')) {
    return { valid: false, message: "Key must start with 'sk-or-'" };
  }

  if (cleanedKey.length < 30) {
    return { valid: false, message: "Key too short (min 30 characters)" };
  }

  if (!/^sk-or-[a-zA-Z0-9-]+$/.test(cleanedKey)) {
    return { valid: false, message: "Key contains invalid characters" };
  }

  return { valid: true, key: cleanedKey };
}

function attachReplyBar(commentBox) {
  // Remove any existing bar to prevent duplicates
  const existingBar = commentBox.parentNode.querySelector('.ai-reply-bar');
  if (existingBar) {
    existingBar.remove();
  }

  // Check if bar was dismissed for this comment box
  if (commentBox.dataset.aiReplyDismissed === 'true') {
    return;
  }

  // Create the AI reply bar
  const replyBar = document.createElement('div');
  replyBar.className = 'ai-reply-bar linkedin-ai-reply-bar';
  replyBar.setAttribute('aria-label', 'AI Reply Bar');
  replyBar.setAttribute('data-ai-reply-bar', 'true');

  // Apply inline styles for LinkedIn
  if (window.location.hostname.includes('linkedin')) {
    replyBar.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: relative !important;
      z-index: 2147483647 !important;
      background: rgba(30, 30, 40, 0.9) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      padding: 14px 18px !important;
      margin: 12px 0 !important;
      border-radius: 18px !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3) !important;
      transform: translateZ(0) !important;
    `;
  }

  // Debug: Log styles
  console.log('AI Reply Bar created with styles:', replyBar.style.cssText);

  // Inject styles into parent Shadow DOM
  let parent = commentBox;
  while (parent) {
    if (parent.shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .ai-reply-bar.linkedin-ai-reply-bar {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 2147483647 !important;
        }
        .ai-generate-button, .ai-clear-button, .ai-cancel-button {
          background: #3b82f6 !important;
          color: white !important;
          padding: 6px 12px !important;
          border: none !important;
          border-radius: 4px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: background 0.2s !important;
          margin-left: 8px !important;
        }
        .ai-generate-button:hover, .ai-clear-button:hover, .ai-cancel-button:hover {
          background: #2563eb !important;
        }
        .ai-generate-button:disabled, .ai-clear-button:disabled, .ai-cancel-button:disabled {
          background: #6b7280 !important;
          cursor: not-allowed !important;
        }
      `;
      parent.shadowRoot.appendChild(style);
      console.log('Injected styles into Shadow DOM for:', parent);
    }
    parent = parent.parentNode;
  }

  // Add RPD counter display
  const rpdDisplay = document.createElement('div');
  rpdDisplay.className = 'ai-rpd-display';
  rpdDisplay.textContent = `Requests today: ${requestsToday}/${RPD_LIMIT}`;
  rpdDisplay.style.marginRight = 'auto';
  rpdDisplay.style.fontSize = '12px';
  rpdDisplay.style.color = '#6b7280';

  // Tone buttons container
  const toneContainer = document.createElement('div');
  toneContainer.className = 'ai-tone-container';
  toneContainer.setAttribute('role', 'radiogroup');
  toneContainer.setAttribute('aria-label', 'Select reply tone');

  const tones = ['Professional', 'Friendly', 'Enthusiastic', 'Funny'];
  tones.forEach((tone, index) => {
    const toneButton = document.createElement('button');
    toneButton.className = 'ai-tone-button';
    toneButton.textContent = tone;
    toneButton.setAttribute('role', 'radio');
    toneButton.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
    toneButton.setAttribute('data-value', tone.toLowerCase());
    toneContainer.appendChild(toneButton);
  });

  // Action buttons container
  const actionContainer = document.createElement('div');
  actionContainer.className = 'ai-action-container';

  // Generate button
  const generateButton = document.createElement('button');
  generateButton.className = 'ai-generate-button';
  generateButton.textContent = 'Generate';
  generateButton.setAttribute('aria-label', 'Generate AI Reply');
  generateButton.disabled = false;

  // Clear button
  const clearButton = document.createElement('button');
  clearButton.className = 'ai-clear-button';
  clearButton.textContent = 'Clear';
  clearButton.setAttribute('aria-label', 'Clear reply');
  clearButton.disabled = false;

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'ai-cancel-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.setAttribute('aria-label', 'Cancel AI Reply Bar');
  cancelButton.addEventListener('click', () => {
    replyBar.remove();
    commentBox.dataset.aiReplyDismissed = 'true';
    // Reset dismissed state on next click
    const resetDismissed = () => {
      commentBox.dataset.aiReplyDismissed = 'false';
      attachReplyBar(commentBox); // Reattach bar immediately on click
      commentBox.removeEventListener('click', resetDismissed);
    };
    commentBox.addEventListener('click', resetDismissed, { once: true });
  });

  actionContainer.appendChild(generateButton);
  actionContainer.appendChild(clearButton);
  actionContainer.appendChild(cancelButton);

  // Label for tone container
  const toneLabel = document.createElement('label');
  toneLabel.textContent = '';
  toneLabel.setAttribute('for', 'tone-container');
  toneContainer.id = 'tone-container';

  // Append elements to bar
  replyBar.appendChild(rpdDisplay);
  replyBar.appendChild(toneLabel);
  replyBar.appendChild(toneContainer);
  replyBar.appendChild(actionContainer);

  // Insert the bar after the comment box
  const container = commentBox.closest('div') || commentBox.parentNode;
  container.parentNode.insertBefore(replyBar, container.nextSibling);

  // Debug: Log insertion and computed styles
  console.log('AI Reply Bar inserted after:', container);
  console.log('Reply bar computed styles:', window.getComputedStyle(replyBar));

  // Select first tone by default
  toneContainer.querySelector('.ai-tone-button').classList.add('selected');

  // Tone button interaction
  toneContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.ai-tone-button');
    if (target) {
      toneContainer.querySelectorAll('.ai-tone-button').forEach(btn => {
        btn.setAttribute('aria-checked', 'false');
        btn.classList.remove('selected');
      });
      target.setAttribute('aria-checked', 'true');
      target.classList.add('selected');
    }
  });

  // Monitor visibility with MutationObserver
  const styleObserver = new MutationObserver(() => {
    const computedStyle = window.getComputedStyle(replyBar);
    if (computedStyle.display === 'none' || computedStyle.opacity === '0' || computedStyle.visibility === 'hidden') {
      replyBar.style.display = 'flex !important';
      replyBar.style.opacity = '1 !important';
      replyBar.style.visibility = 'visible !important';
      console.log('Re-applied visibility styles to ai-reply-bar');
    }
  });

  styleObserver.observe(replyBar, {
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // Generate button click handler
  generateButton.addEventListener('click', async () => {
    if (isRequestInProgress) {
      showErrorNotification('Please wait until the current request completes');
      return;
    }

    if (requestsToday >= RPD_LIMIT) {
      showErrorNotificationWithAction(
        `You've reached your daily limit of ${RPD_LIMIT} requests.`,
        'Upgrade Plan',
        () => window.open('https://openrouter.ai/account', '_blank')
      );
      return;
    }

    const selectedTone = toneContainer.querySelector('.ai-tone-button.selected').getAttribute('data-value');
    const originalButtonText = generateButton.textContent;

    generateButton.innerHTML = '<div class="loading"></div>';
    generateButton.disabled = true;
    clearButton.disabled = true;
    cancelButton.disabled = true;

    try {
      let postContent = '';
      if (window.location.hostname.includes('linkedin')) {
        const postElement = commentBox.closest('.feed-shared-update-v2') ||
                          commentBox.closest('.feed-shared-update-v2__description-wrapper') ||
                          commentBox.closest('.msg-s-event-listitem');
        if (postElement) {
          postContent = postElement.textContent.trim();
        }
      } else if (window.location.hostname.includes('twitter') || window.location.hostname.includes('x.com')) {
        const tweetElement = commentBox.closest('[data-testid="tweet"]') ||
                           commentBox.closest('[data-testid="tweetText"]') ||
                           document.querySelector('[data-testid="tweet"] [lang]');
        if (tweetElement) {
          postContent = tweetElement.textContent.trim();
        }
      }

      if (!postContent) {
        throw new Error('Could not find post content to reply to.');
      }

      const { openRouterApiKey } = await chrome.storage.sync.get(['openRouterApiKey']);
      if (!openRouterApiKey) {
        throw new Error('No OpenRouter API key found. Please set it in the extension options.');
      }

      const { valid, message } = validateApiKey(openRouterApiKey);
      if (!valid) {
        throw new Error(message);
      }

      if (openRouterApiKey.startsWith('sk-or-v1-')) {
        console.log('Using OpenRouter v1 API key');
      }

      const prompt = generatePrompt(selectedTone, postContent);
      const reply = await generateAIResponse(prompt, openRouterApiKey);

      if (!reply) {
        throw new Error('No response generated from the AI.');
      }

      requestsToday++;
      chrome.storage.sync.set({
        requestCount: requestsToday,
        lastRequestDate: new Date().toDateString()
      });
      rpdDisplay.textContent = `Requests today: ${requestsToday}/${RPD_LIMIT}`;

      insertReply(commentBox, reply);
    } catch (error) {
      console.error('Error generating reply:', error);
      showErrorNotification(error.message || 'Failed to generate reply. Please try again.');
    } finally {
      generateButton.textContent = originalButtonText;
      generateButton.disabled = false;
      clearButton.disabled = false;
      cancelButton.disabled = false;
    }
  });

  clearButton.addEventListener('click', () => {
    clearCommentBox(commentBox);
  });
}

function checkForCommentBoxes() {
  // LinkedIn selectors
  const linkedInSelectors = [
    'div.comments-comment-box__editor div.ql-editor',
    'div.feed-shared-comment-box div[role="textbox"]',
    'div[data-control-name="comment_text_input"] textarea',
    'div.msg-form__contenteditable[role="textbox"]'
  ];

  // Twitter/X selector
  const twitterSelectors = [
    'div[data-testid="tweetTextarea_0"]'
  ];

  const fallbackSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'textarea[aria-label*="comment"], textarea[placeholder*="comment"]',
    'div[contenteditable="true"][aria-label*="comment"]'
  ];

  // Handle LinkedIn comment boxes
  if (window.location.hostname.includes('linkedin')) {
    linkedInSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
          attachReplyBar(element);
          element.dataset.aiReplyAttached = 'true';
          // Add click listener to reattach bar if dismissed
          element.addEventListener('click', () => {
            if (element.dataset.aiReplyDismissed === 'true') {
              element.dataset.aiReplyDismissed = 'false';
              attachReplyBar(element);
            }
          }, { once: true });
        }
      });
    });

    fallbackSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
          attachReplyBar(element);
          element.dataset.aiReplyAttached = 'true';
          // Add click listener to reattach bar if dismissed
          element.addEventListener('click', () => {
            if (element.dataset.aiReplyDismissed === 'true') {
              element.dataset.aiReplyDismissed = 'false';
              attachReplyBar(element);
            }
          }, { once: true });
        }
      });
    });
  }

  // Handle X reply bar when /status/ is in URL
  if ((window.location.hostname.includes('twitter') || window.location.hostname.includes('x.com')) &&
      window.location.pathname.includes('/status/')) {
    twitterSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(element => {
          if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
            attachReplyBar(element);
            element.dataset.aiReplyAttached = 'true';
            // Add click listener to reattach bar if dismissed
            element.addEventListener('click', () => {
              if (element.dataset.aiReplyDismissed === 'true') {
                element.dataset.aiReplyDismissed = 'false';
                attachReplyBar(element);
              }
            }, { once: true });
          }
        });
      }
    });
  }
}

function checkForCommentBoxes() {
  // LinkedIn selectors
  const linkedInSelectors = [
    'div.comments-comment-box__editor div.ql-editor',
    'div.feed-shared-comment-box div[role="textbox"]',
    'div[data-control-name="comment_text_input"] textarea',
    'div.msg-form__contenteditable[role="textbox"]'
  ];

  // Twitter/X selector
  const twitterSelectors = [
    'div[data-testid="tweetTextarea_0"]'
  ];

  const fallbackSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'textarea[aria-label*="comment"], textarea[placeholder*="comment"]',
    'div[contenteditable="true"][aria-label*="comment"]'
  ];

  // Handle LinkedIn comment boxes
  if (window.location.hostname.includes('linkedin')) {
    linkedInSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
          attachReplyBar(element);
          element.dataset.aiReplyAttached = 'true';
          // Add click listener to reattach bar if dismissed
          element.addEventListener('click', () => {
            if (element.dataset.aiReplyDismissed === 'true') {
              element.dataset.aiReplyDismissed = 'false';
              attachReplyBar(element);
            }
          }, { once: true });
        }
      });
    });

    fallbackSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
          attachReplyBar(element);
          element.dataset.aiReplyAttached = 'true';
          // Add click listener to reattach bar if dismissed
          element.addEventListener('click', () => {
            if (element.dataset.aiReplyDismissed === 'true') {
              element.dataset.aiReplyDismissed = 'false';
              attachReplyBar(element);
            }
          }, { once: true });
        }
      });
    });
  }

  // Handle X reply bar when /status/ is in URL
  if ((window.location.hostname.includes('twitter') || window.location.hostname.includes('x.com')) &&
      window.location.pathname.includes('/status/')) {
    twitterSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach(element => {
          if (!element.dataset.aiReplyAttached || !element.parentNode.querySelector('.ai-reply-bar')) {
            attachReplyBar(element);
            element.dataset.aiReplyAttached = 'true';
            // Add click listener to reattach bar if dismissed
            element.addEventListener('click', () => {
              if (element.dataset.aiReplyDismissed === 'true') {
                element.dataset.aiReplyDismissed = 'false';
                attachReplyBar(element);
              }
            }, { once: true });
          }
        });
      }
    });
  }
}

// Periodic visibility check
function ensureBarVisibility() {
  document.querySelectorAll('.ai-reply-bar.linkedin-ai-reply-bar').forEach(bar => {
    const computedStyle = window.getComputedStyle(bar);
    if (computedStyle.display === 'none' || computedStyle.opacity === '0' || computedStyle.visibility === 'hidden') {
      bar.style.display = 'flex !important';
      bar.style.opacity = '1 !important';
      bar.style.visibility = 'visible !important';
      console.log('Forced visibility for ai-reply-bar:', bar);
    }
  });
}

// Run visibility check periodically
setInterval(ensureBarVisibility, 1000);

async function generateAIResponse(prompt, apiKey) {
  if (isRequestInProgress) {
    throw new Error('Please wait before making another request');
  }

  isRequestInProgress = true;
  let response;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    console.log('[AI] Sending request with prompt:', prompt.substring(0, 50) + '...');

    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'AI Reply Generator'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = errorData.error?.message || JSON.stringify(errorData);
      } catch (e) {
        errorDetails = 'Could not parse error response';
      }
      throw new Error(`API responded with ${response.status}: ${errorDetails}`);
    }

    const data = await response.json();
    console.log('[AI] Received response:', data);

    if (!data || typeof data !== 'object') {
      throw new Error('API returned invalid response format');
    }

    if (!data.hasOwnProperty('choices')) {
      const errorInfo = data.error || data;
      let userMessage = `The AI service didn't return valid responses. This usually means:
1. The model is currently overloaded
2. Your prompt triggered content filters
3. There's a temporary API issue

Try:
• Waiting a few minutes
• Using a different tone
• Making your prompt shorter`;

      if (errorInfo.message && errorInfo.message.includes('free-models-per-day')) {
        userMessage = `You've exceeded the free tier limit of ${RPD_LIMIT} requests per day. Add 10 credits to unlock 1000 free model requests per day.`;
      }

      throw new Error(userMessage);
    }

    if (!Array.isArray(data.choices)) {
      throw new Error('Choices property is not an array');
    }

    if (data.choices.length === 0) {
      throw new Error('API returned empty choices array. Try reducing your prompt length.');
    }

    const firstChoice = data.choices[0];
    if (!firstChoice?.message?.content) {
      throw new Error('API response missing message content');
    }

    const content = firstChoice.message.content.trim();
    if (!content) {
      throw new Error('API returned empty message content');
    }

    return content;
  } catch (error) {
    console.error('[AI] Generation failed:', error);

    let userMessage = error.message;

    if (error.name === 'AbortError') {
      userMessage = 'Request timed out (25s). The server may be busy.';
    } else if (error.message.includes('No choices array') ||
               error.message.includes('Missing choices array')) {
      userMessage = `The AI service didn't return valid responses. This usually means:
1. The model is currently overloaded
2. Your prompt triggered content filters
3. There's a temporary API issue

Try:
• Waiting a few minutes
• Using a different tone
• Making your prompt shorter`;
    } else if (error.message.includes('free-models-per-day')) {
      userMessage = `You've exceeded the free tier limit of ${RPD_LIMIT} requests per day. Add 10 credits to unlock 1000 free model requests per day.`;
      showErrorNotificationWithAction(userMessage, 'Upgrade Plan', () => window.open('https://openrouter.ai/account', '_blank'));
    } else if (error.message.includes('Failed to fetch')) {
      userMessage = 'Network error. Check your internet connection.';
    } else if (error.message.includes('Invalid API key')) {
      userMessage = 'Your API key is invalid. Please check your OpenRouter key.';
    }

    throw new Error(userMessage);
  } finally {
    isRequestInProgress = false;
    if (response) {
      response.body?.cancel().catch(() => {});
    }
  }
}

function showErrorNotification(message) {
  document.querySelectorAll('.ai-error-notification').forEach(el => el.remove());

  const notification = document.createElement('div');
  notification.className = 'ai-error-notification';

  const icon = document.createElement('span');
  icon.innerHTML = '⚠️';
  icon.style.marginRight = '8px';
  notification.appendChild(icon);

  const lines = message.split('\n');
  lines.forEach((line, i) => {
    const lineEl = document.createElement('div');
    lineEl.textContent = line;
    if (i > 0) lineEl.style.marginTop = '4px';
    notification.appendChild(lineEl);
  });

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.className = 'ai-error-close';
  closeBtn.addEventListener('click', () => {
    notification.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => notification.remove(), 300);
  });
  notification.appendChild(closeBtn);

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => notification.remove(), 300);
  }, 10000);
}

function showErrorNotificationWithAction(message, actionText, actionHandler) {
  document.querySelectorAll('.ai-notification').forEach(el => el.remove());

  const notification = document.createElement('div');
  notification.className = 'ai-notification';

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageSpan.style.marginRight = '10px';

  const actionButton = document.createElement('button');
  actionButton.textContent = actionText;
  actionButton.className = 'ai-notification-button';
  actionButton.addEventListener('click', actionHandler);

  notification.appendChild(messageSpan);
  notification.appendChild(actionButton);

  Object.assign(notification.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 16px',
    backgroundColor: '#ef4444',
    color: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: '100000',
    animation: 'slideIn 0.3s forwards',
    display: 'flex',
    alignItems: 'center'
  });

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => notification.remove(), 300);
  }, 10000);
}

function generatePrompt(tone, postContent) {
  const cleanedContent = postContent
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?']/g, '')
    .trim()
    .substring(0, 500);

  const tonePresets = {
    professional: {
      instruction: "Write a professional response using formal business language that feels authentic and human, avoiding overly polished or formulaic phrasing. Focus on themes like self-improvement, productivity, or professional growth, with a motivational, practical, or reflective tone. Use short, direct sentences or bullet points to deliver clear, actionable insights, mirroring the concise style of a professional tweet. Ensure the response sounds like it could be written by a person sharing advice on a platform like X.",
      examples: [
        "Thanks for the reminder—passion really does drive focus. I’m inspired to lock in and push harder.",
        "Great tip on sleep habits! I’ll try this tonight to boost my performance tomorrow.",
        "I needed this. Believing in myself is the first step to making things happen—thanks for the nudge.",
        "Solid advice on saying I don’t know.’ It’s a simple way to build trust and keep learning."
      ]
    },
    friendly: {
      instruction: "Write a warm, personable response that builds connection, using a friendly and approachable tone. Focus on themes like motivation, productivity, or personal growth, and reflect the concise, authentic style of a professional tweet. Use natural language that feels like a genuine reaction from someone on a platform like X, avoiding stiff or overly formal phrasing.",
      examples: [
        "Hey, thanks for this—your passion tip really fired me up to stay focused today!",
        "Love the sleep advice! I’m definitely trying it tonight—thanks for the boost!",
        "This belief thing hit home—thanks for the encouragement, it’s just what I needed!",
        "Great point on ‘I don’t know’—feels so real and helpful, thanks for sharing!"
      ]
    },
    enthusiastic: {
      instruction: "Write an energetic, positive response showing excitement, using an upbeat and lively tone. Focus on themes like motivation, productivity, or personal growth, and reflect the concise, authentic style of a professional tweet. Use natural language that feels like an excited reaction from someone on a platform like X, incorporating emojis where appropriate to enhance the enthusiasm. choose two emojies from these:🙌🎇🚀",
      examples: [
        "Wow, this passion tip is 🔥! I'm so pumped to lock in and get moving—thanks for the spark!",
        "This sleep hack is a game-changer! 😍 Can't wait to try it tonight—thanks for sharing!",
        "Yes! Believing in myself has never felt so powerful—huge thanks for this boost! 🚀",
        "Love the 'I don't know' advice! So inspiring to keep learning—you're killing it! 🌟"
      ]
    },
    funny: {
      instruction: "Write a witty, light-hearted response with appropriate humor, using a playful and friendly tone. Focus on themes like motivation, productivity, or personal growth, and reflect the concise, authentic style of a professional tweet. Use natural language that feels like a humorous reaction from someone on a platform like X, incorporating emojis where appropriate to emphasize the playful tone, while ensuring the humor remains professional and respectful. choose two emojies from these: 😅🎇🚀",
      examples: [
        "Okay, passion making me unstoppable? I might need to calm down before I take over the world! 😄 Thanks for the tip!",
        "Sleep tips to be ahead of 90% of people? Guess I’ll be the early bird who gets the worm—and a nap! 😂",
        "Believing in myself to grab anything? Does that include the last slice of pizza? 🍕 Thanks for the vibe check!",
        "Saying 'I don't know' to build trust? I might say it too much and end up learning everything—help! 😅"
      ]
    }
  };

  const preset = tonePresets[tone.toLowerCase()] || tonePresets.professional;

  return `Craft a social media reply with these guidelines:
  - Tone: ${preset.instruction}
  - Length: 1-2 concise sentences
  - Style: ${preset.examples.join(' OR ')}
  - Content: Must directly relate to the original post
  - Restrictions: No hashtags, no emojis, no links, no hyphen, no double quotes at the beginning and end. just give me the response

  Original Post: "${cleanedContent}"

  Generated Response:`;
}

function insertReply(commentBox, reply) {
  try {
    if (commentBox.tagName === 'TEXTAREA') {
      commentBox.value = reply;
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    } else if (commentBox.hasAttribute('contenteditable')) {
      commentBox.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, reply);
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    } else if (commentBox.classList.contains('ql-editor')) {
      commentBox.innerHTML = '';
      commentBox.textContent = reply;
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error inserting reply:', error);
    throw new Error('Failed to insert reply into the comment box.');
  }
}

function clearCommentBox(commentBox) {
  try {
    if (commentBox.tagName === 'TEXTAREA') {
      commentBox.value = '';
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    } else if (commentBox.hasAttribute('contenteditable')) {
      commentBox.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    } else if (commentBox.classList.contains('ql-editor')) {
      commentBox.innerHTML = '';
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error clearing comment box:', error);
    showErrorNotification('Failed to clear the comment box.');
  }
}

function injectStylesIntoShadowRoots() {
  document.querySelectorAll('*').forEach(element => {
    if (element.shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .ai-reply-bar {
          opacity: 1 !important;
          visibility: visible !important;
          display: flex !important;
        }
      `;
      element.shadowRoot.appendChild(style);
    }
  });
}
// Run periodically
setInterval(injectStylesIntoShadowRoots, 1000);
