// Store references to current elements
let currentFloatingBar = null;
let currentCommentBox = null;
let currentPostText = '';
let isLoading = false;
let selectedTone = 'professional';
let currentPlatform = 'linkedin'; // 'linkedin' or 'twitter'

// Define consistent light theme styles
const baseFloatingBarStyle = `
  position: relative;
  border-radius: 8px;
  padding: 12px;
  margin-top: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 9999;
  font-family: 'Roboto', sans-serif; /* Ensure consistent font */
`;

const baseButtonStyle = `
  height: 32px;
  border-radius: 16px;
  font-family: 'Roboto', sans-serif;
  font-size: 12px;
  text-align: left;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent; /* Base border */
`;

const lightStyles = `
  background: #F5F8FA;
  border-color: #E1E8ED; /* Use border-color from baseButtonStyle */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const twitterToneBtnActiveStyle = `
  background: #1DA1F2 !important;
  color: white !important;
  border-color: #1DA1F2 !important;
`;

const floatingBarHTML = `
<div class="choosyai-bar" style="${baseFloatingBarStyle} ${lightStyles}">
  <button class="tone-btn active" data-tone="professional" style="
    width: 110px;
    ${baseButtonStyle}
    background: #1DA1F2;
    color: white;
    border-color: #1DA1F2;
  ">Professional</button>

  <button class="tone-btn" data-tone="friendly" style="
    width: 80px;
    ${baseButtonStyle}
    background: transparent;
    border: 1px solid #E1E8ED;
    color: #657786;
  ">Friendly</button>

  <button class="tone-btn" data-tone="funny" style="
    width: 80px;
    ${baseButtonStyle}
    background: transparent;
    border: 1px solid #E1E8ED;
    color: #657786;
  ">Funny</button>

  <button class="generate-btn" style="
    width: 80px;
    ${baseButtonStyle}
    background: #17BF63;
    color: white;
    border: none;
    margin-left: auto;
  ">Generate</button>

  <button class="clear-btn" style="
    width: 80px;
    ${baseButtonStyle}
    background: #E0245E;
    color: white;
    border: none;
  ">Clear</button>

  <div class="loading-indicator" style="
    display: none;
    margin-left: 10px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #1DA1F2;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
  "></div>
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .choosyai-bar .tone-btn:hover { /* Scope to bar */
    transform: scale(1.05);
    box-shadow: 0 0 5px rgba(29, 161, 242, 0.3);
  }
  .choosyai-bar .tone-btn.active { /* Scope to bar */
    ${twitterToneBtnActiveStyle}
  }
  .choosyai-bar .generate-btn:hover:not(:disabled) { /* Scope to bar */
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(23, 191, 99, 0.5);
  }
  .choosyai-bar .generate-btn:disabled { /* Scope to bar */
    background: #CCCCCC;
    cursor: not-allowed;
  }
  .choosyai-bar .clear-btn:hover:not(:disabled) { /* Scope to bar */
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(224, 36, 94, 0.5);
  }
  .choosyai-bar .clear-btn:disabled { /* Scope to bar */
    background: #CCCCCC;
    cursor: not-allowed;
  }
</style>
`;

function handleFloatingBar(commentBox) {
    // console.log('[Choosyai] handleFloatingBar called with commentBox:', commentBox); // DEBUG
    if (!commentBox || !commentBox.isConnected) { // Also check if commentBox is still in DOM
        // console.log('[Choosyai] No valid commentBox provided or commentBox not connected to DOM.'); // DEBUG
        if (currentFloatingBar && currentFloatingBar.parentNode) {
             // console.log('[Choosyai] Removing existing floating bar because new commentBox is invalid or not focused.'); // DEBUG
            currentFloatingBar.parentNode.removeChild(currentFloatingBar);
            currentFloatingBar = null;
            currentCommentBox = null; // Clear currentCommentBox as well
        }
        return;
    }

    if (currentCommentBox && currentCommentBox !== commentBox) {
        if (currentFloatingBar && currentFloatingBar.parentNode) {
            // console.log('[Choosyai] Different commentBox focused. Removing old floating bar.'); // DEBUG
            currentFloatingBar.parentNode.removeChild(currentFloatingBar);
        }
        currentFloatingBar = null;
        currentCommentBox = null;
    }

    // If the bar is already shown for the current comment box, do nothing.
    if (currentFloatingBar && currentCommentBox === commentBox) {
        // console.log('[Choosyai] Floating bar already exists for this commentBox.'); // DEBUG
        return;
    }

    if (commentBox && !currentFloatingBar) {
        // console.log('[Choosyai] Creating new floating bar for commentBox:', commentBox); // DEBUG
        const bar = document.createElement('div');
        bar.innerHTML = floatingBarHTML; // Corrected: No need for replace

        if (commentBox.parentNode) {
            commentBox.parentNode.insertBefore(bar, commentBox.nextSibling);
            // console.log('[Choosyai] Floating bar inserted into parent:', commentBox.parentNode); // DEBUG
        } else {
            // console.error('[Choosyai] CommentBox parentNode is null. Cannot insert floating bar.'); // DEBUG
            return;
        }

        currentFloatingBar = bar.firstChild; // a div is created, then floatingBarHTML is its innerHTML, so the actual bar is the firstChild of the created div.
        currentCommentBox = commentBox;

        currentPlatform = window.location.hostname.includes('twitter.com') ||
                          window.location.hostname.includes('x.com') ? 'twitter' : 'linkedin';
        // console.log('[Choosyai] Platform detected:', currentPlatform); // DEBUG

        currentPostText = getPostText();
        // console.log('[Choosyai] Post text extracted:', currentPostText); // DEBUG

        const generateBtn = currentFloatingBar.querySelector('.generate-btn');
        const clearBtn = currentFloatingBar.querySelector('.clear-btn');
        const loadingIndicator = currentFloatingBar.querySelector('.loading-indicator');
        const toneButtons = currentFloatingBar.querySelectorAll('.tone-btn');

        toneButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                toneButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = '#657786';
                    b.style.border = '1px solid #E1E8ED';
                });

                e.target.classList.add('active');
                e.target.style.background = '#1DA1F2';
                e.target.style.color = 'white';
                e.target.style.border = '1px solid #1DA1F2';
                selectedTone = e.target.dataset.tone;
                // console.log('[Choosyai] Tone selected:', selectedTone); // DEBUG
            });
        });

        generateBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isLoading) return;

            try {
                isLoading = true;
                generateBtn.disabled = true;
                clearBtn.disabled = true;
                loadingIndicator.style.display = 'block';
                generateBtn.style.width = '70px'; // Temporarily shrink

                const comment = await generateAIComment(currentPostText, selectedTone, currentPlatform);
                insertComment(currentCommentBox, comment);
            } catch (error) {
                console.error('[Choosyai] Error generating comment:', error);
                let errorMessage = "Couldn't generate comment. Please try again.";
                if (error.message && error.message.includes('Rate limit exceeded')) {
                    errorMessage = "Rate limit exceeded. Add credits or wait for the limit to reset.";
                } else if (error.message && error.message.includes('API key not set')){
                    errorMessage = "API Key not set. Please set it in options.";
                }
                insertComment(currentCommentBox, errorMessage); // Insert error into comment box for visibility
            } finally {
                isLoading = false;
                generateBtn.disabled = false;
                clearBtn.disabled = false;
                loadingIndicator.style.display = 'none';
                generateBtn.style.width = '80px'; // Restore width
            }
        });

        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearCommentBox(currentCommentBox);
        });
    }
}

function getPostText() {
    try {
        if (currentPlatform === 'twitter') {
            const tweetElement = document.querySelector('[data-testid="tweetText"]') ||
                                 document.querySelector('article [lang]') || // More generic
                                 document.querySelector('[role="article"] [lang]'); // Even more generic
            return tweetElement ? tweetElement.textContent.trim() : '';
        } else { // LinkedIn
            const postElement = document.querySelector('.feed-shared-update-v2__description .text-view-model, .feed-shared-text .text-view-model, .commentary span, .update-components-text span') || // Added more specific LinkedIn selectors
                                document.querySelector('.feed-shared-update-v2__description, .feed-shared-text') || // Original selectors
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
    // console.warn('[Choosyai] No post text found to generate comment against.'); // DEBUG
    // Consider if this should be an error or a specific type of comment
    // For now, let's allow generating a generic comment if postText is empty
    // throw new Error('No post text found to generate comment');
  }

  try {
    const apiKey = await getAPIKey();
    if (!apiKey) {
      showAPIKeyWarning(); // This function should ideally be called where it can append to the bar
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

    const modelsToTry = [
      'mistralai/mistral-small-latest', // Updated to a common Mistral model name
    ];

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

        // console.log(`[Choosyai] API Response from ${model}:`, data); // DEBUG
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
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.error('[Choosyai] Chrome storage API is not available');
      // Fallback for environments where chrome.storage might not be available (e.g. testing)
      // You might want to provide a default key or handle this differently
      return reject(new Error('Chrome storage API is not available'));
    }

    chrome.storage.sync.get(['openRouterKey'], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.error('[Choosyai] Error retrieving API key:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.openRouterKey || null);
      }
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
    warning.style.width = '100%'; // Take full width of bar
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
    // Append to the bar itself, not as a sibling
    const mainBarDiv = currentFloatingBar.querySelector('.choosyai-bar') || currentFloatingBar;
    if(mainBarDiv) {
        mainBarDiv.appendChild(warning);
    }


    setTimeout(() => {
      if (warning.parentNode) {
        warning.parentNode.removeChild(warning);
      }
    }, 7000); // Increased visibility time
  }
}

// Enhanced debug function to see exactly what's in the X/Twitter DOM
function inspectXDom() {
  console.log('=== [Choosyai] Detailed X/Twitter DOM Inspection ===');

  const allEditables = document.querySelectorAll('[contenteditable="true"]');
  console.log(`[Choosyai] Found ${allEditables.length} contentEditable elements on the page:`);
  allEditables.forEach((el, i) => {
    console.log(`[Choosyai] ContentEditable #${i}:`, {
      element: el,
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      dataText: el.getAttribute('data-text'),
      parentTestId: el.closest('[data-testid]')?.getAttribute('data-testid'),
      isVisible: isElementVisible(el),
      textContent: el.textContent?.substring(0, 50) + (el.textContent?.length > 50 ? '...' : '')
    });
  });

  const allTextboxes = document.querySelectorAll('[role="textbox"]');
  console.log(`[Choosyai] Found ${allTextboxes.length} elements with role="textbox":`);
  allTextboxes.forEach((el, i) => {
    console.log(`[Choosyai] Textbox #${i}:`, {
      element: el,
      isContentEditable: el.isContentEditable,
      ariaLabel: el.getAttribute('aria-label'),
      dataText: el.getAttribute('data-text'),
      parentTestId: el.closest('[data-testid]')?.getAttribute('data-testid'),
      isVisible: isElementVisible(el),
      textContent: el.textContent?.substring(0, 50) + (el.textContent?.length > 50 ? '...' : '')
    });
  });

  const dataTestIds = ['tweetTextarea', 'reply', 'tweet', 'post', 'editor', 'composer_text_editor', 'ConversationBody']; // Added more
  dataTestIds.forEach(testId => {
    const elements = document.querySelectorAll(`[data-testid*="${testId}"], [aria-label*="${testId}" i]`); // Also check aria-label
    console.log(`[Choosyai] Found ${elements.length} elements with data-testid or aria-label containing "${testId}"`);
    elements.forEach((el, i) => {
      console.log(`[Choosyai] ${testId} #${i}:`, {
        element: el,
        dataTestId: el.getAttribute('data-testid'),
        ariaLabel: el.getAttribute('aria-label'),
        hasTextbox: !!el.querySelector('[role="textbox"]'),
        hasContentEditable: !!el.querySelector('[contenteditable="true"]'),
        isVisible: isElementVisible(el)
      });
    });
  });

  const possibleInputContainers = document.querySelectorAll('div[class*="public"], div[class*="draft"], div[class*="editor"], div[class*="text"], div[class*="input"]');
  console.log(`[Choosyai] Found ${possibleInputContainers.length} potential input containers by class name`);

  return "[Choosyai] Inspection completed. Check console for details.";
}

function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0 && el.offsetWidth > 0;
}

function findCommentBox(element) {
    if (!element || typeof element.closest !== 'function') return null; // Basic check

    if (element.closest('.choosyai-bar')) {
        return null; // Avoid selecting the floating bar itself
    }

    let commentBox = null;
    const hostname = window.location.hostname;

    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        // console.log('[Choosyai Twitter DBG] findCommentBox target:', element); // DEBUG
        // X/Twitter: Look for contenteditable divs that are likely reply boxes.
        // Common patterns: inside a "reply" context or a "tweetTextarea"
        const specificEditor = element.closest('[data-testid="tweetTextarea"]')?.querySelector('div[contenteditable="true"]');
        if (specificEditor && isElementVisible(specificEditor)) {
            // console.log('[Choosyai Twitter DBG] Found X/Twitter comment box (specific tweetTextarea editable):', specificEditor); // DEBUG
            return specificEditor;
        }

        // More general approach: find contenteditable within a potential tweet/reply context
        // data-testid="reply" is often on the button, not the input area.
        // Look for aria-label containing "Tweet text" or "Reply"
        if (element.getAttribute('role') === 'textbox' && element.isContentEditable && (element.getAttribute('aria-label')?.toLowerCase().includes('tweet text') || element.getAttribute('aria-label')?.toLowerCase().includes('reply'))) {
             // console.log('[Choosyai Twitter DBG] Found X/Twitter comment box (direct target is contenteditable textbox with aria-label):', element); // DEBUG
            return element;
        }

        const parentContext = element.closest('div[data-testid^="cellInnerDiv"]'); // A common cell container for tweets/composer
        if(parentContext){
            const potentialBox = parentContext.querySelector('div[contenteditable="true"][role="textbox"][aria-label*="Tweet text"], div[contenteditable="true"][role="textbox"][aria-label*="Reply"]');
            if(potentialBox && isElementVisible(potentialBox)){
                // console.log('[Choosyai Twitter DBG] Found X/Twitter comment box (within cellInnerDiv, contenteditable textbox with aria-label):', potentialBox); // DEBUG
                return potentialBox;
            }
        }

        // Fallback Draft.js-like selector (often seen in older versions or complex editors)
        const draftEditor = document.querySelector('div[class*="DraftEditor-root"] div[contenteditable="true"], div[class*="public-DraftEditor-content"][contenteditable="true"]');
        if (draftEditor && isElementVisible(draftEditor) && (draftEditor === element || draftEditor.contains(element))) {
            // console.log('[Choosyai Twitter DBG] Found X/Twitter comment box (Draft.js fallback):', draftEditor); // DEBUG
            return draftEditor;
        }
        // If the focused element itself is the one we want
        if (element.matches('div[contenteditable="true"][role="textbox"]')) {
             // console.log('[Choosyai Twitter DBG] Found X/Twitter comment box (element is contenteditable textbox):', element); // DEBUG
            return element;
        }


    } else if (hostname.includes('linkedin.com')) {
        // console.log('[Choosyai LinkedIn DBG] findCommentBox target:', element); // DEBUG
        // LinkedIn selectors
        // Check if the element itself is the target
        if (element.matches('.comments-comment-box__editor, .ql-editor[role="textbox"], .msg-form__contenteditable[role="textbox"]')) {
            // console.log('[Choosyai LinkedIn DBG] Found LinkedIn comment box (direct match):', element); // DEBUG
            return element;
        }
        // Try to find it within the closest relevant container
        commentBox = element.closest('.comments-comment-box, .comment-input, .msg-form__compose-area, .feed-shared-comment-box')
                        ?.querySelector('.comments-comment-box__editor, .ql-editor[role="textbox"], .msg-form__contenteditable[role="textbox"], div[contenteditable="true"][role="textbox"]');

        if (commentBox && isElementVisible(commentBox)) {
            // console.log('[Choosyai LinkedIn DBG] Found LinkedIn comment box (closest container then querySelector):', commentBox); // DEBUG
            return commentBox;
        }
    }
    // console.log('[Choosyai DBG] No comment box found for element:', element); // DEBUG
    return null;
}

// --- Consolidated Event Listeners ---
function handleFocusOrClick(event) {
    const targetElement = event.target;
    let potentialBox = findCommentBox(targetElement);
    let source = event.type; // 'focusin' or 'click'

    if (potentialBox) {
        // console.log(`[Choosyai] ${source} Event - Target:`, targetElement, 'Comment Box Found Direct:', potentialBox); // DEBUG
        handleFloatingBar(potentialBox);
    } else {
        // Also check parents in case focus/click is on a child element within the comment box
        let parent = targetElement.parentNode;
        while (parent && parent !== document.body) {
            potentialBox = findCommentBox(parent);
            if (potentialBox) {
                // console.log(`[Choosyai] ${source} Event (Parent) - Target:`, targetElement, 'Comment Box Found in Parent:', potentialBox); // DEBUG
                handleFloatingBar(potentialBox);
                break;
            }
            parent = parent.parentNode;
        }
    }
}

document.addEventListener('focusin', handleFocusOrClick, true);
document.addEventListener('click', handleFocusOrClick, true);

// Initial check for already active element when script loads
if (document.activeElement) {
    const initialBox = findCommentBox(document.activeElement);
    if (initialBox) {
        // console.log('[Choosyai] Initial Check - Active Element:', document.activeElement, 'Comment Box Found:', initialBox); // DEBUG
        handleFloatingBar(initialBox);
    } else {
         // Also check parents of active element
        let parent = document.activeElement.parentNode;
        while (parent && parent !== document.body) {
            const parentBox = findCommentBox(parent);
            if (parentBox) {
                // console.log('[Choosyai] Initial Check (Parent) - Active Element:', document.activeElement, 'Comment Box Found in Parent:', parentBox); // DEBUG
                handleFloatingBar(parentBox);
                break;
            }
            parent = parent.parentNode;
        }
    }
}

// Mutation Observer to detect comment box creation/focus on X/Twitter
if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        let commentInput = findCommentBox(node);
                        if (commentInput && isElementVisible(commentInput)) { // Check visibility
                            handleFloatingBar(commentInput);
                            return; // Found, no need to check children of this added node further for top-level
                        }
                        // Also check within the added nodes for nested comment boxes (if findCommentBox is not structured to find children)
                        const nestedCommentInput = node.querySelector('div[contenteditable="true"][role="textbox"], div[class*="DraftEditor-root"] div[contenteditable="true"]');
                        if (nestedCommentInput && isElementVisible(nestedCommentInput)) {
                            handleFloatingBar(nestedCommentInput);
                        }
                    }
                });
            } else if (mutation.type === 'attributes') { // e.g. a placeholder div becomes editable, or style changes to visible
                if (mutation.target instanceof Element) {
                    const commentInput = findCommentBox(mutation.target);
                    if (commentInput && isElementVisible(commentInput)) {
                        handleFloatingBar(commentInput);
                    }
                }
            }
        }
    });

    // Observe the whole body, but be mindful of performance.
    // attributeFilter can help, but sometimes new elements get classes/attributes that make them comment boxes.
    const config = { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable', 'role', 'class', 'style', 'data-testid', 'aria-label'] };
    observer.observe(document.body, config);
}
// --- End Consolidated Event Listeners ---


// Advanced insertComment function with multiple fallback methods for X/Twitter
function insertComment(commentBox, text) {
  if (!commentBox || !text || !commentBox.isConnected) {
    console.error('[Choosyai] Insert Comment Failed: Invalid comment box, text, or commentBox not connected.', {commentBox, text});
    return;
  }

  try {
    // console.log('[Choosyai] Inserting Comment into:', commentBox, 'Text:', text); // DEBUG

    commentBox.focus();

    if (currentPlatform === 'twitter') {
      // console.log('[Choosyai] Using Twitter-specific insertion logic'); // DEBUG
      let insertionSuccessful = false;

      // Method 1: Direct textContent for contenteditable (often works if React isn't heavily guarding)
      // For Draft.js or similar, direct manipulation of spans might be needed if this fails
      try {
        if (commentBox.isContentEditable) {
          // For editors that structure text in child nodes (like Draft.js with spans for each char/line)
          // It might be better to clear and reconstruct, or use execCommand
          // For simpler contenteditables, textContent might work.
          commentBox.textContent = text;
          // Dispatch events that React might listen for
          commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          if (commentBox.textContent === text) {
            // console.log('[Choosyai] Method 1 (textContent + events) successful for Twitter'); // DEBUG
            insertionSuccessful = true;
          }
        }
      } catch (e) { console.warn('[Choosyai] Twitter Method 1 failed:', e); }


      // Method 2: execCommand (Often more reliable for rich text editors)
      if (!insertionSuccessful) {
        try {
          // Select all existing content
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(commentBox);
          selection.removeAllRanges();
          selection.addRange(range);

          if (document.queryCommandSupported('insertText')) {
            document.execCommand('insertText', false, text);
          } else { // Fallback for older or non-standard
            document.execCommand('delete', false, null); // Clear selection
            document.execCommand('insertHTML', false, text); // Insert new text
          }
          // Check if text was inserted (might be slightly different due to editor formatting)
          if (commentBox.textContent.includes(text) || commentBox.innerHTML.includes(text)) {
            // console.log('[Choosyai] Method 2 (execCommand) successful for Twitter'); // DEBUG
            insertionSuccessful = true;
            // Dispatch events again
            commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          }
        } catch (e) { console.warn('[Choosyai] Twitter Method 2 (execCommand) failed:', e); }
      }

      // Method 3: Character by character simulation (Most complex, last resort)
      if (!insertionSuccessful) {
        // This method is very complex and often still fails with modern JS frameworks.
        // For brevity and because execCommand is usually preferred, this is omitted in this fix
        // but was present in the original. If execCommand fails, this is the next area to explore.
        // console.warn('[Choosyai] Character simulation method (Method 4) skipped for Twitter in this fix.'); // DEBUG
      }


      if (insertionSuccessful) {
        ['blur', 'focus'].forEach(eventType => { // Some frameworks react to blur/focus to update state
          commentBox.dispatchEvent(new Event(eventType, { bubbles: true, composed: true }));
        });
        // console.log('[Choosyai] Twitter Text insertion complete, content is now:', commentBox.textContent); // DEBUG
      } else {
        console.error('[Choosyai] All Twitter insertion methods failed. Trying basic textContent as ultimate fallback.');
        commentBox.textContent = text; // Simplest fallback
        commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }

    } else { // LinkedIn or other platforms
      if (commentBox.classList && commentBox.classList.contains('ql-editor')) { // Quill editor (common on LinkedIn)
        const quill = commentBox.closest('.ql-container')?.__quill; // Attempt to get Quill instance
        if (quill) {
          quill.setText(text);
          // console.log('[Choosyai] Used Quill API to set text for LinkedIn.'); // DEBUG
        } else {
          commentBox.innerHTML = `<p>${text}</p>`; // Simple HTML for Quill if instance not found
        }
      } else if (commentBox.isContentEditable) {
        commentBox.textContent = text;
      } else if (typeof commentBox.value !== 'undefined') { // Standard input/textarea
        commentBox.value = text;
      } else { // Fallback
         document.execCommand('insertText', false, text);
      }
      commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  } catch (error) {
    console.error('[Choosyai] Error inserting comment:', error);
    try { // Ultimate fallback
      commentBox.textContent = text;
      commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    } catch (e) {
      console.error('[Choosyai] Even ultimate fallback insertion failed:', e);
    }
  }
}

function clearCommentBox(commentBox) {
  if (!commentBox || !commentBox.isConnected) return;

  try {
    commentBox.focus();

    if (currentPlatform === 'twitter') {
      if (commentBox.isContentEditable) {
        commentBox.textContent = ''; // Simpler clear
        // Dispatch events to ensure X's internal state updates
        commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        // X sometimes needs a keyup to truly register empty
        commentBox.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true, composed: true }));
      } else if (typeof commentBox.value !== 'undefined') {
        commentBox.value = '';
        commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      }
    } else { // LinkedIn
      if (commentBox.classList && commentBox.classList.contains('ql-editor')) {
         const quill = commentBox.closest('.ql-container')?.__quill;
         if (quill) quill.setText(''); else commentBox.innerHTML = '<p><br></p>'; // Quill likes a paragraph with a break for empty
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
    try { // Last resort fallback
      if (commentBox.isContentEditable) commentBox.innerHTML = '';
      else if (typeof commentBox.value !== 'undefined') commentBox.value = '';
      commentBox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    } catch (e) {
      console.error('[Choosyai] Fallback clear failed:', e);
    }
  }
}


// Global error handling
window.addEventListener('error', (event) => {
  console.error('[Choosyai] Global error caught by content script:', event.error, event.message, event.filename, event.lineno, event.colno);
});

// Clean up before unloading (ensure the bar is removed)
window.addEventListener('beforeunload', () => {
  if (currentFloatingBar && currentFloatingBar.parentNode) {
    currentFloatingBar.parentNode.removeChild(currentFloatingBar);
    currentFloatingBar = null;
  }
  currentCommentBox = null;
});

console.log('[Choosyai] Content script loaded and initialized.');
