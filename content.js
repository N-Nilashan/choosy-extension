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
`;

const lightStyles = `
  background: #F5F8FA;
  border: 1px solid #E1E8ED;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const twitterToneBtnActiveStyle = `
  background: #1DA1F2 !important;
  color: white !important;
  border-color: #1DA1F2 !important;
`;

const floatingBarHTML = `
<div class="choosyai-bar" style="${baseFloatingBarStyle} ${lightStyles}">
  <!-- Tone Buttons -->
  <button class="tone-btn active" data-tone="professional" style="
    width: 110px;
    ${baseButtonStyle}
    background: #1DA1F2;
    color: white;
    border: 1px solid #1DA1F2;
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

  <!-- Generate Button -->
  <button class="generate-btn" style="
    width: 80px;
    ${baseButtonStyle}
    background: #17BF63;
    color: white;
    border: none;
    margin-left: auto;
  ">Generate</button>

  <!-- Clear Button -->
  <button class="clear-btn" style="
    width: 80px;
    ${baseButtonStyle}
    background: #E0245E;
    color: white;
    border: none;
  ">Clear</button>

  <!-- Loading Indicator -->
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
  .tone-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 5px rgba(29, 161, 242, 0.3);
  }
  .tone-btn.active {
    ${twitterToneBtnActiveStyle}
  }
  .generate-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(23, 191, 99, 0.5);
  }
  .generate-btn:disabled {
    background: #CCCCCC;
    cursor: not-allowed;
  }
  .clear-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(224, 36, 94, 0.5);
  }
  .clear-btn:disabled {
    background: #CCCCCC;
    cursor: not-allowed;
  }
</style>
`;

function handleFloatingBar(commentBox) {
    if (!commentBox) return;

    if (currentCommentBox && currentCommentBox !== commentBox) {
        if (currentFloatingBar && currentFloatingBar.parentNode) {
            currentFloatingBar.parentNode.removeChild(currentFloatingBar);
        }
        currentFloatingBar = null;
        currentCommentBox = null;
    }

    if (commentBox && !currentFloatingBar) {
        const bar = document.createElement('div');
        bar.innerHTML = floatingBarHTML.replace('${baseFloatingBarStyle} ${lightStyles}', `${baseFloatingBarStyle} ${lightStyles}`);
        commentBox.parentNode.insertBefore(bar, commentBox.nextSibling);
        currentFloatingBar = bar;
        currentCommentBox = commentBox;

        // Detect platform
        currentPlatform = window.location.hostname.includes('twitter.com') ||
                            window.location.hostname.includes('x.com') ? 'twitter' : 'linkedin';

        currentPostText = getPostText();

        // Reinitialize UI elements after re-render
        const generateBtn = bar.querySelector('.generate-btn');
        const clearBtn = bar.querySelector('.clear-btn');
        const loadingIndicator = bar.querySelector('.loading-indicator');
        const toneButtons = bar.querySelectorAll('.tone-btn');

        // Tone button click handler
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
            });
        });

        // Generate button click handler
        generateBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

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
                console.error('Error generating comment:', error);
                let errorMessage = "Couldn't generate comment. Please try again.";
                if (error.message.includes('Rate limit exceeded')) {
                    errorMessage = "Rate limit exceeded. Add credits or wait for the limit to reset.";
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

        // Clear button click handler
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
                                 document.querySelector('article [lang]') ||
                                 document.querySelector('[role="article"] [lang]');
            return tweetElement ? tweetElement.textContent.trim() : '';
        } else {
            const postElement = document.querySelector('.feed-shared-update-v2__description, .feed-shared-text') ||
                                 document.querySelector('[data-id^="urn:li:activity"] .break-words');
            return postElement ? postElement.textContent.trim() : '';
        }
    } catch (error) {
        console.error('Error getting post text:', error);
        return '';
    }
}


async function generateAIComment(postText, tone, platform) {
  if (!postText) {
    throw new Error('No post text found to generate comment');
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

Post content: "${postText.trim()}"

Generated ${tone} comment:`;

    const modelsToTry = [
      'mistralai/mistral-small-3.1-24b-instruct:free',
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
          const errorData = await response.json();
          if (response.status === 429) {
            throw new Error('Rate limit exceeded: ' + (errorData.error?.message || 'Unknown rate limit error'));
          }
          throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();

        console.log(`API Response from ${model}:`, data);
        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          console.error(`Invalid API response structure from ${model}:`, data);
          throw new Error('Invalid API response: No choices array found');
        }

        const choice = data.choices[0];
        if (!choice.message || !choice.message.content) {
          console.error(`Invalid choice structure from ${model}:`, choice);
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
        console.warn(`Failed to generate comment with model ${model}:`, error.message);
        continue;
      }
    }

    throw lastError || new Error('All available models failed to generate a comment');
  } catch (error) {
    console.error('Error generating AI comment:', error);
    throw error;
  }
}

async function getAPIKey() {
  return new Promise((resolve, reject) => {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.error('Chrome storage API is not available');
      reject(new Error('Chrome storage API is not available'));
      return;
    }

    chrome.storage.sync.get(['openRouterKey'], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.error('Error retrieving API key:', chrome.runtime.lastError);
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
    warning.textContent = 'Please set your API key in extension options';
    warning.style.color = 'red';
    warning.style.marginTop = '10px';
    warning.style.fontSize = '12px';
    warning.style.display = 'flex';
    warning.style.alignItems = 'center';

    const optionsLink = document.createElement('a');
    optionsLink.textContent = 'Open Settings';
    optionsLink.href = '#';
    optionsLink.style.marginLeft = '5px';
    optionsLink.style.color = '#1DA1F2';
    optionsLink.style.textDecoration = 'underline';
    optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (chrome && chrome.runtime) {
        chrome.runtime.openOptionsPage();
      }
    });

    warning.appendChild(optionsLink);
    currentFloatingBar.appendChild(warning);

    setTimeout(() => {
      if (warning.parentNode) {
        warning.parentNode.removeChild(warning);
      }
    }, 5000);
  }
}

// Enhanced debug function to see exactly what's in the X/Twitter DOM
function inspectXDom() {
  console.log('=== Detailed X/Twitter DOM Inspection ===');

  // Look for any contentEditable elements
  const allEditables = document.querySelectorAll('[contenteditable="true"]');
  console.log(`Found ${allEditables.length} contentEditable elements on the page:`);

  allEditables.forEach((el, i) => {
    console.log(`ContentEditable #${i}:`, {
      element: el,
      role: el.getAttribute('role'),
      dataText: el.getAttribute('data-text'),
      parentTestId: el.closest('[data-testid]')?.getAttribute('data-testid'),
      isVisible: isElementVisible(el),
      textContent: el.textContent?.substring(0, 50) + (el.textContent?.length > 50 ? '...' : '')
    });
  });

  // Also find any textbox roles
  const allTextboxes = document.querySelectorAll('[role="textbox"]');
  console.log(`Found ${allTextboxes.length} elements with role="textbox":`);

  allTextboxes.forEach((el, i) => {
    console.log(`Textbox #${i}:`, {
      element: el,
      isContentEditable: el.isContentEditable,
      dataText: el.getAttribute('data-text'),
      parentTestId: el.closest('[data-testid]')?.getAttribute('data-testid'),
      isVisible: isElementVisible(el),
      textContent: el.textContent?.substring(0, 50) + (el.textContent?.length > 50 ? '...' : '')
    });
  });

  // Look for elements with the most common Twitter attributes
  const dataTestIds = ['tweetTextarea', 'reply', 'tweet', 'post', 'editor'];

  dataTestIds.forEach(testId => {
    const elements = document.querySelectorAll(`[data-testid*="${testId}"]`);
    console.log(`Found ${elements.length} elements with data-testid containing "${testId}"`);

    elements.forEach((el, i) => {
      console.log(`${testId} #${i}:`, {
        element: el,
        dataTestId: el.getAttribute('data-testid'),
        hasTextbox: !!el.querySelector('[role="textbox"]'),
        hasContentEditable: !!el.querySelector('[contenteditable="true"]'),
        isVisible: isElementVisible(el)
      });
    });
  });

  // Check for specific new X structure (they often use divs with specific class names)
  const possibleInputContainers = document.querySelectorAll('div[class*="public"], div[class*="draft"], div[class*="editor"], div[class*="text"], div[class*="input"]');
  console.log(`Found ${possibleInputContainers.length} potential input containers`);

  return "Inspection completed. Check console for details.";
}

// Helper to check if an element is visible
function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
}

// Updated findCommentBox function with more comprehensive detection
function findCommentBox(element) {
    if (!element) return null;

    // Avoid selecting the floating bar
    if (element.closest('.choosyai-bar')) {
        return null;
    }

    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
        // Look for any contenteditable div within a likely tweet/reply container
        const tweetContext = element.closest('[data-testid="tweet"], [data-testid="reply"]');
        if (tweetContext) {
            const editableDiv = tweetContext.querySelector('div[contenteditable="true"]');
            if (editableDiv) {
                console.log('X Comment Box Detection (Simple Editable):', editableDiv);
                return editableDiv;
            }
        }
        // Fallback to the specific Draft.js class if the above doesn't work immediately
        const draftEditor = document.querySelector('div[class*="DraftStyleDefault-block"][class*="DraftStyleDefault-ltr"][contenteditable="true"]');
        if (draftEditor) {
            console.log('X Comment Box Detection (Fallback Draft):', draftEditor);
            return draftEditor;
        }
        return null;
    }

    // LinkedIn detection (remains the same)
    const commentBox = element.closest('.comments-comment-box, .comment-input')?.querySelector(
        '.comments-comment-box__editor, [role="textbox"], .ql-editor, .ql-editor.ql-blank'
    ) || element;

    return (commentBox?.classList?.contains('comments-comment-box__editor') ||
            commentBox?.getAttribute('role') === 'textbox' ||
            commentBox?.classList?.contains('ql-editor'))
            ? commentBox : null;
}

document.addEventListener('focusin', (e) => {
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
        const potentialBox = findCommentBox(e.target);
        if (potentialBox) {
            console.log('Focusin Event - Target:', e.target, 'Comment Box Found:', potentialBox);
            handleFloatingBar(potentialBox);
        } else {
            // Also check parents in case focus is on a child element
            let parent = e.target.parentNode;
            while (parent && !potentialBox && parent !== document.body) {
                potentialBox = findCommentBox(parent);
                if (potentialBox) {
                    console.log('Focusin Event (Parent) - Target:', e.target, 'Comment Box Found:', potentialBox);
                    handleFloatingBar(potentialBox);
                    break;
                }
                parent = parent.parentNode;
            }
        }
    } else {
        handleFloatingBar(findCommentBox(e.target));
    }
}, true);

document.addEventListener('click', (e) => {
    if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
        const potentialBox = findCommentBox(e.target);
        if (potentialBox) {
            console.log('Click Event - Target:', e.target, 'Comment Box Found:', potentialBox);
            handleFloatingBar(potentialBox);
        } else {
            // Also check parents in case click is on a child element
            let parent = e.target.parentNode;
            while (parent && !potentialBox && parent !== document.body) {
                potentialBox = findCommentBox(parent);
                if (potentialBox) {
                    console.log('Click Event (Parent) - Target:', e.target, 'Comment Box Found:', potentialBox);
                    handleFloatingBar(potentialBox);
                    break;
                }
                parent = parent.parentNode;
            }
        }
    } else {
        handleFloatingBar(findCommentBox(e.target));
    }
}, true);

if (document.activeElement && (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com'))) {
    const initialBox = findCommentBox(document.activeElement);
    if (initialBox) {
        console.log('Initial Check - Active Element:', document.activeElement, 'Comment Box Found:', initialBox);
        handleFloatingBar(initialBox);
    }
} else if (document.activeElement) {
    handleFloatingBar(findCommentBox(document.activeElement));
}

// Mutation Observer to detect comment box creation/focus on X
if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        const commentInput = findCommentBox(node);
                        if (commentInput) {
                            handleFloatingBar(commentInput);
                        }
                        // Also check within the added nodes for nested comment boxes
                        const nestedCommentInput = node.querySelector('div[class*="DraftStyleDefault-block"][class*="DraftStyleDefault-ltr"][contenteditable="true"]');
                        if (nestedCommentInput) {
                            handleFloatingBar(nestedCommentInput);
                        }
                    }
                });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'data-focus') {
                const targetElement = mutation.target;
                const commentInput = findCommentBox(targetElement);
                if (commentInput) {
                    handleFloatingBar(commentInput);
                }
            }
        }
    });

    const config = { childList: true, subtree: true, attributes: true, attributeFilter: ['data-focus'] };
    observer.observe(document.body, config);
}

document.addEventListener('focusin', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Focusin Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

document.addEventListener('click', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Click Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

if (document.activeElement) {
    const commentBox = findCommentBox(document.activeElement);
    console.log('Initial Check - Active Element:', document.activeElement, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}

document.addEventListener('focusin', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Focusin Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

document.addEventListener('click', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Click Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

if (document.activeElement) {
    const commentBox = findCommentBox(document.activeElement);
    console.log('Initial Check - Active Element:', document.activeElement, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}

document.addEventListener('focusin', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Focusin Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

document.addEventListener('click', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Click Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

if (document.activeElement) {
    const commentBox = findCommentBox(document.activeElement);
    console.log('Initial Check - Active Element:', document.activeElement, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}

document.addEventListener('focusin', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Focusin Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

document.addEventListener('click', (e) => {
    const commentBox = findCommentBox(e.target);
    console.log('Click Event - Target:', e.target, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}, true);

if (document.activeElement) {
    const commentBox = findCommentBox(document.activeElement);
    console.log('Initial Check - Active Element:', document.activeElement, 'Comment Box:', commentBox);
    handleFloatingBar(commentBox);
}

// Advanced insertComment function with multiple fallback methods for X/Twitter
function insertComment(commentBox, text) {
  if (!commentBox || !text || !commentBox.isConnected) {
    console.error('Insert Comment Failed: Invalid comment box or text provided', commentBox);
    return;
  }

  try {
    console.log('Inserting Comment into:', commentBox, 'Text:', text);

    // Ensure we're focused on the comment box
    commentBox.focus();

    if (currentPlatform === 'twitter') {
      console.log('Using Twitter-specific insertion logic');

      // Try multiple insertion methods for X/Twitter
      let insertionSuccessful = false;

      // Method 1: Direct innerHTML manipulation
      try {
        commentBox.innerHTML = text;
        const event = new Event('input', { bubbles: true, composed: true });
        commentBox.dispatchEvent(event);

        // Check if text was inserted
        if (commentBox.textContent === text) {
          console.log('Method 1 (innerHTML) successful');
          insertionSuccessful = true;
        }
      } catch (e) {
        console.warn('Method 1 failed:', e);
      }

      // Method 2: Clear and append text node
      if (!insertionSuccessful) {
        try {
          commentBox.innerHTML = '';
          const textNode = document.createTextNode(text);
          commentBox.appendChild(textNode);

          const event = new Event('input', { bubbles: true, composed: true });
          commentBox.dispatchEvent(event);

          if (commentBox.textContent === text) {
            console.log('Method 2 (appendChild) successful');
            insertionSuccessful = true;
          }
        } catch (e) {
          console.warn('Method 2 failed:', e);
        }
      }

      // Method 3: execCommand (older browsers)
      if (!insertionSuccessful) {
        try {
          // First select all existing content and delete it
          const range = document.createRange();
          range.selectNodeContents(commentBox);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);

          document.execCommand('delete', false, null);
          document.execCommand('insertText', false, text);

          if (commentBox.textContent === text) {
            console.log('Method 3 (execCommand) successful');
            insertionSuccessful = true;
          }
        } catch (e) {
          console.warn('Method 3 failed:', e);
        }
      }

      // Method 4: Character by character simulation
      if (!insertionSuccessful) {
        try {
          commentBox.innerHTML = '';

          // Simulate typing character by character
          let currentText = '';
          for (let i = 0; i < text.length; i++) {
            // Add next character
            currentText += text[i];
            commentBox.textContent = currentText;

            // Dispatch keyboard events
            const keyDownEvent = new KeyboardEvent('keydown', {
              key: text[i],
              bubbles: true,
              composed: true,
              cancelable: true
            });
            commentBox.dispatchEvent(keyDownEvent);

            const keyPressEvent = new KeyboardEvent('keypress', {
              key: text[i],
              bubbles: true,
              composed: true,
              cancelable: true
            });
            commentBox.dispatchEvent(keyPressEvent);

            const inputEvent = new InputEvent('input', {
              bubbles: true,
              composed: true,
              data: text[i],
              inputType: 'insertText'
            });
            commentBox.dispatchEvent(inputEvent);

            const keyUpEvent = new KeyboardEvent('keyup', {
              key: text[i],
              bubbles: true,
              composed: true,
              cancelable: true
            });
            commentBox.dispatchEvent(keyUpEvent);
          }

          if (commentBox.textContent === text) {
            console.log('Method 4 (character simulation) successful');
            insertionSuccessful = true;
          }
        } catch (e) {
          console.warn('Method 4 failed:', e);
        }
      }

      // Final event dispatch to ensure X registers the change
      if (insertionSuccessful) {
        // Dispatch a comprehensive set of events to trigger X's internal state updates
        ['input', 'change', 'blur', 'focus'].forEach(eventType => {
          commentBox.dispatchEvent(new Event(eventType, { bubbles: true, composed: true }));
        });

        console.log('Text insertion complete, content is now:', commentBox.textContent);
      } else {
        console.error('All insertion methods failed');
      }
    } else {
      // LinkedIn insertion - unmodified as it's working
      if (commentBox.classList.contains('ql-editor')) {
        commentBox.innerHTML = text;
      } else if (commentBox.getAttribute('role') === 'textbox') {
        commentBox.textContent = text;
      } else {
        document.execCommand('insertText', false, text);
      }
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error inserting comment:', error);
    // Ultimate fallback - try simplest approach
    try {
      commentBox.textContent = text;
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      console.error('Even fallback insertion failed:', e);
    }
  }
}

function clearCommentBox(commentBox) {
  if (!commentBox) return;

  try {
    commentBox.focus();

    if (currentPlatform === 'twitter') {
      if (commentBox.isContentEditable) {
        // For X/Twitter, directly manipulating the DOM seems more reliable
        commentBox.innerHTML = '';

        // Dispatch events to ensure X's internal state updates
        const inputEvent = new Event('input', { bubbles: true, composed: true });
        commentBox.dispatchEvent(inputEvent);
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));

        // Additional events to make sure X registers the change
        commentBox.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      } else {
        commentBox.value = '';
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      if (commentBox.classList.contains('ql-editor')) {
        commentBox.innerHTML = '';
      } else {
        commentBox.textContent = '';
      }
      const event = new Event('input', { bubbles: true });
      commentBox.dispatchEvent(event);
    }
  } catch (error) {
    console.error('Error clearing comment box:', error);
    // Last resort fallback
    try {
      commentBox.innerHTML = '';
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      console.error('Fallback clear failed:', e);
    }
  }
}

// Event listeners
document.addEventListener('focusin', (e) => {
  const commentBox = findCommentBox(e.target);
  console.log('Focusin Event - Target:', e.target, 'Comment Box:', commentBox);
  handleFloatingBar(commentBox);
}, true);

document.addEventListener('click', (e) => {
  const commentBox = findCommentBox(e.target);
  console.log('Click Event - Target:', e.target, 'Comment Box:', commentBox);
  if (commentBox) {
    handleFloatingBar(commentBox);
  }
}, true);

// Initial check
if (document.activeElement) {
  const commentBox = findCommentBox(document.activeElement);
  console.log('Initial Check - Active Element:', document.activeElement, 'Comment Box:', commentBox);
  handleFloatingBar(commentBox);
}

// Error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

// Clean up before unloading
window.addEventListener('beforeunload', () => {
  if (currentFloatingBar && currentFloatingBar.parentNode) {
    currentFloatingBar.parentNode.removeChild(currentFloatingBar);
  }
});

