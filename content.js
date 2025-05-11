// Store references to current elements
let currentFloatingBar = null;
let currentCommentBox = null;
let currentPostText = '';
let isLoading = false;
let selectedTone = 'professional';
let currentPlatform = 'linkedin'; // 'linkedin' or 'twitter'

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Define consistent styles
const baseFloatingBarStyle = `
  position: absolute;
  border-radius: 8px;
  padding: 12px;
  margin-top: 5px;
  display: flex !important;
  opacity: 1 !important;
  gap: 8px;
  align-items: center;
  z-index: 100000;
  font-family: 'Roboto', sans-serif;
  width: 100%;
  max-width: 500px;
  box-sizing: border-box;
  pointer-events: auto;
  background: inherit;
`;

const baseButtonStyle = `
  height: 32px;
  border-radius: 16px;
  font-family: 'Roboto', sans-serif;
  font-size: 12px;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  pointer-events: auto;
`;

const lightStyles = `
  background: #F5F8FA;
  border: 1px solid #E1E8ED;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: #1A1A1A;
`;

const darkStyles = `
  background: #2F3336;
  border: 1px solid #536471;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  color: #D9D9D9;
`;

// Detect theme dynamically
const getThemeStyles = () => {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDarkMode ? darkStyles : lightStyles;
};

const floatingBarHTML = `
<div class="choosyai-bar" style="${baseFloatingBarStyle} ${getThemeStyles()}">
  <button class="tone-btn active" data-tone="professional">Professional</button>
  <button class="tone-btn" data-tone="friendly">Friendly</button>
  <button class="tone-btn" data-tone="funny">Funny</button>
  <button class="generate-btn">Generate</button>
  <button class="clear-btn">Clear</button>
  <div class="loading-indicator"></div>
</div>
<style>
  .choosyai-bar * {
    pointer-events: auto !important;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .choosyai-bar .tone-btn {
    width: 110px;
    ${baseButtonStyle}
  }
  .choosyai-bar .tone-btn[data-tone="professional"] {
    background: #1DA1F2;
    color: white;
    border-color: #1DA1F2;
  }
  .choosyai-bar .tone-btn[data-tone="friendly"],
  .choosyai-bar .tone-btn[data-tone="funny"] {
    width: 80px;
    background: transparent;
    border: 1px solid #E1E8ED;
    color: #657786;
  }
  .choosyai-bar .generate-btn {
    width: 80px;
    ${baseButtonStyle}
    background: #17BF63;
    color: white;
    border: none;
    margin-left: auto;
  }
  .choosyai-bar .clear-btn {
    width: 80px;
    ${baseButtonStyle}
    background: #E0245E;
    color: white;
    border: none;
  }
  .choosyai-bar .loading-indicator {
    display: none;
    margin-left: 10px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #1DA1F2;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  }
  .choosyai-bar .tone-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 5px rgba(29, 161, 242, 0.3);
  }
  .choosyai-bar .tone-btn.active {
    background: #1DA1F2 !important;
    color: white !important;
    border-color: #1DA1F2 !important;
  }
  .choosyai-bar .generate-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(23, 191, 99, 0.5);
  }
  .choosyai-bar .generate-btn:disabled {
    background: #CCCCCC;
    cursor: not-allowed;
  }
  .choosyai-bar .clear-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(224, 36, 94, 0.5);
  }
  .choosyai-bar .clear-btn:disabled {
    background: #CCCCCC;
    cursor: not-allowed;
  }
</style>
`;

function handleFloatingBar(commentBox) {
  console.log('[Choosyai] handleFloatingBar called with commentBox:', commentBox);

  if (!commentBox || !commentBox.isConnected) {
    console.warn('[Choosyai] Comment box is invalid or not connected to DOM');
    if (currentFloatingBar && currentFloatingBar.parentNode) {
      currentFloatingBar.__cleanup?.();
      currentFloatingBar.parentNode.removeChild(currentFloatingBar);
      currentFloatingBar = null;
      currentCommentBox = null;
    }
    return;
  }

  if (currentCommentBox && currentCommentBox !== commentBox) {
    console.log('[Choosyai] Switching to a new comment box');
    if (currentFloatingBar && currentFloatingBar.parentNode) {
      currentFloatingBar.__cleanup?.();
      currentFloatingBar.parentNode.removeChild(currentFloatingBar);
    }
    currentFloatingBar = null;
    currentCommentBox = null;
  }

  if (currentFloatingBar && currentCommentBox === commentBox) {
    console.log('[Choosyai] Floating bar already exists for this comment box');
    return;
  }

  if (commentBox && !currentFloatingBar) {
    if (!commentBox.parentNode || !commentBox.parentNode.isConnected) {
      console.warn('[Choosyai] Comment box parent node is missing or not connected');
      return;
    }

    console.log('[Choosyai] Creating and inserting floating bar');
    const bar = document.createElement('div');
    bar.innerHTML = floatingBarHTML;
    try {
      commentBox.parentNode.insertBefore(bar, commentBox.nextSibling);
    } catch (error) {
      console.error('[Choosyai] Failed to append floating bar:', error);
      return;
    }

    currentFloatingBar = bar.firstChild;
    currentCommentBox = commentBox;

    console.log('[Choosyai] Floating bar inserted:', currentFloatingBar);

    // Dynamically position the bar below the comment box
    const updateBarPosition = debounce(() => {
      if (!currentFloatingBar || !currentFloatingBar.isConnected || !currentFloatingBar.parentNode || !currentFloatingBar.style) {
        console.log('[Choosyai] Skipping updateBarPosition: Floating bar is invalid or not connected');
        return;
      }
      try {
        const rect = currentCommentBox.getBoundingClientRect();
        const top = Math.max(0, rect.bottom + window.scrollY + 2);
        const left = Math.max(0, rect.left + window.scrollX);
        currentFloatingBar.style.top = `${top}px`;
        currentFloatingBar.style.left = `${left}px`;
        currentFloatingBar.style.width = `${rect.width}px`;
        console.log('[Choosyai] Updated bar position:', { top, left, width: rect.width });
      } catch (error) {
        console.error('[Choosyai] Error updating bar position:', error);
      }
    }, 100);

    updateBarPosition();
    window.addEventListener('resize', updateBarPosition);
    window.addEventListener('scroll', updateBarPosition);

    // Clean up listeners
    currentFloatingBar.__cleanup = () => {
      console.log('[Choosyai] Cleaning up event listeners for floating bar');
      window.removeEventListener('resize', updateBarPosition);
      window.removeEventListener('scroll', updateBarPosition);
    };

    currentPlatform = window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com') ? 'twitter' : 'linkedin';
    currentPostText = getPostText();

    // Attach event listeners
    const generateBtn = currentFloatingBar.querySelector('.generate-btn');
    const clearBtn = currentFloatingBar.querySelector('.clear-btn');
    const loadingIndicator = currentFloatingBar.querySelector('.loading-indicator');
    const toneButtons = currentFloatingBar.querySelectorAll('.tone-btn');

    toneButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log('[Choosyai] Tone button clicked:', btn.dataset.tone);
        toneButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTone = btn.dataset.tone;
      });
    });

    generateBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[Choosyai] Generate button clicked');
      if (isLoading) return;
      try {
        isLoading = true;
        generateBtn.disabled = true;
        clearBtn.disabled = true;
        loadingIndicator.style.display = 'block';
        generateBtn.style.width = '70px';
        const comment = await generateAIComment(currentPostText, selectedTone, currentPlatform);
        insertComment(currentCommentBox, comment);
      } catch (error) {
        console.error('[Choosyai] Error generating comment:', error);
        let errorMessage = "Couldn't generate comment. Please try again.";
        if (error.message?.includes('Rate limit exceeded')) {
          errorMessage = "Rate limit exceeded. Add credits or wait for the limit to reset.";
        } else if (error.message?.includes('API key not set')) {
          errorMessage = "API Key not set. Please set it in options.";
        }
        insertComment(currentCommentBox, errorMessage);
      } finally {
        isLoading = false;
        generateBtn.disabled = false;
        clearBtn.disabled = false;
        loadingIndicator.style.display = 'none';
        generateBtn.style.width = '80px';
      }
    });

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[Choosyai] Clear button clicked');
      clearCommentBox(currentCommentBox);
    });
  }
}

function getPostText() {
  try {
    if (currentPlatform === 'twitter') {
      const tweetElement =
        document.querySelector('[data-testid="tweetText"]') ||
        document.querySelector('article [lang]') ||
        document.querySelector('[role="article"] [lang]');
      return tweetElement ? tweetElement.textContent.trim() : '';
    } else {
      const postElement =
        document.querySelector('.feed-shared-update-v2__description .text-view-model, .feed-shared-text .text-view-model, .commentary span, .update-components-text span') ||
        document.querySelector('.feed-shared-update-v2__description, .feed-shared-text') ||
        document.querySelector('[data-id^="urn:li:activity"] .break-words');
      return postElement ? postElement.textContent.trim() : '';
    }
  } catch (error) {
    console.error('[Choosyai] Error getting post text:', error);
    return '';
  }
}

async function generateAIComment(postText, tone, platform) {
  if (!postText) {
    // Allow generating a generic comment if postText is empty
  }

  try {
    const apiKey = await getAPIKey();
    if (!apiKey) {
      showAPIKeyWarning();
      throw new Error('API key not set');
    }

    const toneInstructions = {
      professional: "Write a professional, polished comment that adds value to the discussion.",
      friendly: "Write a warm, engaging comment that builds connection with the author.",
      funny: "Write a humorous, witty comment that will make people smile. Include emojis if appropriate."
    };

    const platformSpecific = {
      linkedin: "This is for LinkedIn - keep it business-appropriate but conversational.",
      twitter: "This is for Twitter/X - keep it concise and punchy (under 280 characters)."
    };

    const prompt = `You're a social media engagement assistant.
${toneInstructions[tone]}
${platformSpecific[platform]}
Respond naturally to this post in 1-2 short sentences max.

Post content: "${postText ? postText.trim() : "The user has not provided specific post content, provide a general engagement comment."}"

Generated ${tone} comment:`;

    const modelsToTry = ['mistralai/mistral-small-latest'];

    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{
              role: 'user',
              content: prompt
            }],
            max_tokens: 150,
            temperature: tone === 'funny' ? 0.7 : 0.5
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error structure' } }));
          if (response.status === 429) {
            throw new Error('Rate limit exceeded: ' + (errorData.error?.message || 'Unknown rate limit error'));
          }
          throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          console.error(`[Choosyai] Invalid API response structure from ${model}:`, data);
          throw new Error('Invalid API response: No choices array found');
        }

        const choice = data.choices[0];
        if (!choice.message || !choice.message.content) {
          console.error(`[Choosyai] Invalid choice structure from ${model}:`, choice);
          throw new Error('Invalid API response: No message content found');
        }

        let comment = choice.message.content.trim();
        if (comment.startsWith('"') && comment.endsWith('"')) {
          comment = comment.slice(1, -1);
        }

        if (platform === 'twitter' && comment.length > 280) {
          comment = comment.substring(0, 277) + '...';
        }

        return comment;
      } catch (error) {
        lastError = error;
        console.warn(`[Choosyai] Failed to generate comment with model ${model}:`, error.message);
        continue;
      }
    }

    throw lastError || new Error('All available models failed to generate a comment');
  } catch (error) {
    console.error('[Choosyai] Error generating AI comment:', error);
    throw error;
  }
}

async function getAPIKey() {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
      console.error('[Choosyai] Chrome storage API is not available');
      return resolve(null);
    }

    chrome.storage.sync.get(['openRouterKey'], (result) => {
      if (chrome.runtime?.lastError) {
        console.error('[Choosyai] Error retrieving API key:', chrome.runtime.lastError);
        return resolve(null);
      }
      resolve(result.openRouterKey || null);
    });
  });
}

function showAPIKeyWarning() {
  if (currentFloatingBar && !currentFloatingBar.querySelector('.api-key-warning')) {
    const warning = document.createElement('div');
    warning.className = 'api-key-warning';
    warning.textContent = 'Please set your API key in extension options. ';
    warning.style.color = 'red';
    warning.style.marginTop = '10px';
    warning.style.fontSize = '12px';
    warning.style.width = '100%';
    warning.style.textAlign = 'center';

    const optionsLink = document.createElement('a');
    optionsLink.textContent = 'Open Settings';
    optionsLink.href = '#';
    optionsLink.style.marginLeft = '5px';
    optionsLink.style.color = '#1DA1F2';
    optionsLink.style.textDecoration = 'underline';
    optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        console.warn('[Choosyai] chrome.runtime.openOptionsPage is not available.');
      }
    });

    warning.appendChild(optionsLink);
    const mainBarDiv = currentFloatingBar.querySelector('.choosyai-bar') || currentFloatingBar;
    if (mainBarDiv) {
      mainBarDiv.appendChild(warning);
    }

    setTimeout(() => {
      if (warning.parentNode) {
        warning.parentNode.removeChild(warning);
      }
    }, 7000);
  }
}

function findCommentBox(element) {
  if (!element || typeof element.closest !== 'function') return null;
  if (element.closest('.choosyai-bar')) return null;

  const hostname = window.location.hostname;

  // X/Twitter specific detection
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    // Try to find the main composer box
    const composer = document.querySelector('[data-testid="tweetTextarea_0"], [data-testid="tweetTextarea"], [role="textbox"][aria-label="Post text"]');
    if (composer) return composer;

    // Fallback to any contenteditable in the composer area
    const composerArea = document.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]')?.closest('[role="dialog"], [aria-labelledby]');
    if (composerArea) {
      const editable = composerArea.querySelector('[contenteditable="true"][role="textbox"]');
      if (editable) return editable;
    }

    // Last resort - any contenteditable textbox
    return document.querySelector('[contenteditable="true"][role="textbox"]');
  }

  // LinkedIn specific detection
  if (hostname.includes('linkedin.com')) {
    if (element.matches('.comments-comment-box__editor, .ql-editor[role="textbox"], .msg-form__contenteditable[role="textbox"]')) {
      return element;
    }
    return element.closest('.comments-comment-box, .comment-input, .msg-form__compose-area, .feed-shared-comment-box')
      ?.querySelector('.comments-comment-box__editor, .ql-editor[role="textbox"], .msg-form__contenteditable[role="textbox"], div[contenteditable="true"][role="textbox"]');
  }
  return null;
}

function insertComment(commentBox, text) {
  if (!commentBox || !text || !commentBox.isConnected) {
    console.error('[Choosyai] Insert Comment Failed: Invalid comment box, text, or commentBox not connected.', { commentBox, text });
    return;
  }

  try {
    commentBox.focus();

    if (currentPlatform === 'twitter') {
      // Twitter/X specific insertion
      const range = document.createRange();
      range.selectNodeContents(commentBox);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // Clear existing content
      commentBox.textContent = '';

      // Insert new text
      commentBox.textContent = text;

      // Dispatch necessary events
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: text
      });
      commentBox.dispatchEvent(inputEvent);

      const changeEvent = new Event('change', { bubbles: true });
      commentBox.dispatchEvent(changeEvent);
    } else {
      // LinkedIn insertion
      if (commentBox.classList?.contains('ql-editor')) {
        const quill = commentBox.closest('.ql-container')?.__quill;
        if (quill) {
          quill.setText(text);
        } else {
          commentBox.innerHTML = `<p>${text}</p>`;
        }
      } else if (commentBox.isContentEditable) {
        commentBox.textContent = text;
      }
      commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  } catch (error) {
    console.error('[Choosyai] Error inserting comment:', error);
    // Fallback
    commentBox.textContent = text;
    commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }
}

function clearCommentBox(commentBox) {
  if (!commentBox || !commentBox.isConnected) return;

  try {
    commentBox.focus();

    if (currentPlatform === 'twitter') {
      if (commentBox.isContentEditable) {
        commentBox.textContent = '';
        commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      } else if (typeof commentBox.value !== 'undefined') {
        commentBox.value = '';
        commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      }
    } else {
      if (commentBox.classList && commentBox.classList.contains('ql-editor')) {
        const quill = commentBox.closest('.ql-container')?.__quill;
        if (quill) quill.setText('');
        else commentBox.innerHTML = '<p><br></p>';
      } else if (commentBox.isContentEditable) {
        commentBox.textContent = '';
      } else if (typeof commentBox.value !== 'undefined') {
        commentBox.value = '';
      }
      commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  } catch (error) {
    console.error('[Choosyai] Error clearing comment box:', error);
    try {
      if (commentBox.isContentEditable) commentBox.innerHTML = '';
      else if (typeof commentBox.value !== 'undefined') commentBox.value = '';
      commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    } catch (e) {
      console.error('[Choosyai] Fallback clear failed:', e);
    }
  }
}

function cleanupFloatingBar() {
  if (currentFloatingBar && currentFloatingBar.parentNode) {
    currentFloatingBar.__cleanup?.();
    currentFloatingBar.parentNode.removeChild(currentFloatingBar);
    currentFloatingBar = null;
  }
  currentCommentBox = null;
}

// Event listeners
document.addEventListener('focusin', (e) => {
  const targetElement = e.target;
  const potentialBox = findCommentBox(targetElement);
  if (potentialBox) {
    handleFloatingBar(potentialBox);
  }
}, true);

document.addEventListener('click', (e) => {
  const targetElement = e.target;
  const potentialBox = findCommentBox(targetElement);
  if (potentialBox) {
    handleFloatingBar(potentialBox);
  }
}, true);

// Initial check for already active element
if (document.activeElement) {
  const initialBox = findCommentBox(document.activeElement);
  if (initialBox) {
    handleFloatingBar(initialBox);
  }
}

// Mutation Observer for X/Twitter
if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            const commentInput = findCommentBox(node);
            if (commentInput && isElementVisible(commentInput)) {
              handleFloatingBar(commentInput);
            }
          }
        });
      }
    }
  });

  const targetNode = document.body;
  if (targetNode) {
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'role', 'class', 'style', 'data-testid', 'aria-label'],
    });
  }
}

// History state changes
const originalPushState = history.pushState;
history.pushState = function () {
  cleanupFloatingBar();
  return originalPushState.apply(history, arguments);
};

const originalReplaceState = history.replaceState;
history.replaceState = function () {
  cleanupFloatingBar();
  return originalReplaceState.apply(history, arguments);
};

window.addEventListener('unload', cleanupFloatingBar);

console.log('[Choosyai] Content script loaded and initialized.');
