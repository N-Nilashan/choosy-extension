// Configuration
const MODEL = "mistralai/mistral-7b-instruct:free";
const MAX_TOKENS = 300;
const TEMPERATURE = 0.7;
const RPD_LIMIT = 100; // OpenRouter's free tier daily limit

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

  // Twitter/X selectors
  const twitterSelectors = [
    'div[data-testid="tweetTextarea_0"]',
    'div[data-testid="reply"] div.public-DraftEditor-content',
    'div[contenteditable="true"][data-testid*="tweetTextarea"]'
  ];

  // Fallback selectors
  const fallbackSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'textarea[aria-label*="comment"], textarea[placeholder*="comment"]',
    'div[contenteditable="true"][aria-label*="comment"]'
  ];

  // Combine all selectors
  const allSelectors = [...linkedInSelectors, ...twitterSelectors, ...fallbackSelectors];

  allSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      // Check if the bar is missing or detached
      const existingBar = element.parentNode.querySelector('.ai-reply-bar');
      if (!element.dataset.aiReplyAttached || !existingBar) {
        attachReplyBar(element);
        element.dataset.aiReplyAttached = 'true';
      }
    });
  });
}

function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, message: "No API key provided" };
  }

  // Remove any whitespace
  const cleanedKey = apiKey.trim();

  // Accept both v1 keys (sk-or-v1-) and standard keys (sk-or-)
  if (!cleanedKey.startsWith('sk-or-')) {
    return { valid: false, message: "Key must start with 'sk-or-'" };
  }

  // Minimum length check (v1 keys are longer)
  if (cleanedKey.length < 30) {
    return { valid: false, message: "Key too short (min 30 characters)" };
  }

  // Updated pattern to accept hyphens in v1 keys
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

  // Create the AI reply bar
  const replyBar = document.createElement('div');
  replyBar.className = 'ai-reply-bar';
  replyBar.setAttribute('aria-label', 'AI Reply Bar');

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

  const tones = [
    'Professional',
    'Friendly',
    'Enthusiastic',
    'Casual',
    'Formal',
    'Humorous'
  ];

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

  actionContainer.appendChild(generateButton);
  actionContainer.appendChild(clearButton);

  // Label for tone container
  const toneLabel = document.createElement('label');
  toneLabel.textContent = 'Tone:';
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

  // Generate button click handler
  generateButton.addEventListener('click', async () => {
    if (isRequestInProgress) {
      showErrorNotification('Please wait until the current request completes');
      return;
    }

    // Check RPD limit
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

    try {
      // Get post content
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

      // Get API key
      const { openRouterApiKey } = await chrome.storage.sync.get(['openRouterApiKey']);

      if (!openRouterApiKey) {
        throw new Error('No OpenRouter API key found. Please set it in the extension options.');
      }

      // Validate API key (updated to support v1 keys)
      const { valid, message } = validateApiKey(openRouterApiKey);
      if (!valid) {
        throw new Error(message);
      }

      // Log if using v1 key
      if (openRouterApiKey.startsWith('sk-or-v1-')) {
        console.log('Using OpenRouter v1 API key');
      }

      // Generate prompt
      const prompt = generatePrompt(selectedTone, postContent);

      // Call API
      const reply = await generateAIResponse(prompt, openRouterApiKey);

      if (!reply) {
        throw new Error('No response generated from the AI.');
      }

      // Update RPD counter
      requestsToday++;
      chrome.storage.sync.set({
        requestCount: requestsToday,
        lastRequestDate: new Date().toDateString()
      });
      rpdDisplay.textContent = `Requests today: ${requestsToday}/${RPD_LIMIT}`;

      // Insert reply
      insertReply(commentBox, reply);

    } catch (error) {
      console.error('Error generating reply:', error);
      showErrorNotification(error.message || 'Failed to generate reply. Please try again.');
    } finally {
      generateButton.textContent = originalButtonText;
      generateButton.disabled = false;
      clearButton.disabled = false;
    }
  });

  // Clear button click handler
  clearButton.addEventListener('click', () => {
    clearCommentBox(commentBox);
  });
}

async function generateAIResponse(prompt, apiKey) {
  if (isRequestInProgress) {
    throw new Error('Please wait before making another request');
  }

  isRequestInProgress = true;
  let response;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    // Debug logging
    console.log('[AI] Sending request with prompt:', prompt.substring(0, 50) + '...');

    // Make the API request
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

    // Handle non-OK responses
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

    // Parse and thoroughly validate response
    const data = await response.json();
    console.log('[AI] Received response:', data);

    if (!data || typeof data !== 'object') {
      throw new Error('API returned invalid response format');
    }

    // Critical fix for "No choices array" error
    if (!data.hasOwnProperty('choices')) {
      // Attempt to get error details from response
      const errorInfo = data.error || data;
      let userMessage = `The AI service didn't return valid responses. This usually means:
1. The model is currently overloaded
2. Your prompt triggered content filters
3. There's a temporary API issue

Try:
• Waiting a few minutes
• Using a different tone
• Making your prompt shorter`;

      // Specific handling for rate limit exceeded
      if (errorInfo.message && errorInfo.message.includes('free-models-per-day')) {
        userMessage = `You've exceeded the free tier limit of ${RPD_LIMIT} requests per day. Add 10 credits to unlock 1000 free model requests per day.`;
        throw new Error(userMessage);
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

    // Enhanced error messages with troubleshooting tips
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
      // Ensure the response body is consumed to prevent memory leaks
      response.body?.cancel().catch(() => {});
    }
  }
}

// Notification functions
function showErrorNotification(message) {
  // Remove existing notifications
  document.querySelectorAll('.ai-error-notification').forEach(el => el.remove());

  const notification = document.createElement('div');
  notification.className = 'ai-error-notification';

  // Add error icon
  const icon = document.createElement('span');
  icon.innerHTML = '⚠️';
  icon.style.marginRight = '8px';
  notification.appendChild(icon);

  // Handle multi-line messages
  const lines = message.split('\n');
  lines.forEach((line, i) => {
    const lineEl = document.createElement('div');
    lineEl.textContent = line;
    if (i > 0) lineEl.style.marginTop = '4px';
    notification.appendChild(lineEl);
  });

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.className = 'ai-error-close';
  closeBtn.addEventListener('click', () => {
    notification.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => notification.remove(), 300);
  });
  notification.appendChild(closeBtn);

  // Apply styles
  Object.assign(notification.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: '100000',
    animation: 'slideIn 0.3s forwards',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column'
  });

  document.body.appendChild(notification);

  // Auto-dismiss after 10 seconds
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

  // Apply styles
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
  // Clean and truncate the post content
  const cleanedContent = postContent
    .replace(/[\r\n]+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/[^\w\s.,!?']/g, '') // Remove special chars
    .trim()
    .substring(0, 500); // Limit to 500 chars

  const tonePresets = {
    professional: {
      instruction: "Write a professional response using formal business language.",
      examples: [
        "Thank you for sharing this insightful perspective.",
        "I appreciate you taking the time to post this valuable information."
      ]
    },
    friendly: {
      instruction: "Write a warm, personable response that builds connection.",
      examples: [
        "Thanks for sharing this - really got me thinking!",
        "Love this perspective! Appreciate you posting it."
      ]
    },
    enthusiastic: {
      instruction: "Write an energetic, positive response showing excitement.",
      examples: [
        "This is fantastic! Thanks for sharing such great content!",
        "Wow, what an amazing perspective! Really appreciate you posting this!"
      ]
    },
    casual: {
      instruction: "Write a relaxed, informal response that sounds natural.",
      examples: [
        "Nice post! Got me thinking about this differently.",
        "Thanks for sharing - really interesting stuff!"
      ]
    },
    formal: {
      instruction: "Write a highly structured, proper response using formal language.",
      examples: [
        "I would like to express my appreciation for this valuable contribution.",
        "This is an exceptionally well-articulated perspective that merits consideration."
      ]
    },
    humorous: {
      instruction: "Write a witty, light-hearted response with appropriate humor.",
      examples: [
        "This post is so good it almost makes me want to forgive you for being right!",
        "Well played! Now I have to rethink everything I thought I knew."
      ]
    }
  };

  const preset = tonePresets[tone.toLowerCase()] || tonePresets.professional;

  return `Craft a social media reply with these guidelines:
  - Tone: ${preset.instruction}
  - Length: 1-2 concise sentences
  - Style: ${preset.examples.join(' OR ')}
  - Content: Must directly relate to the original post
  - Restrictions: No hashtags, no emojis, no links

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
