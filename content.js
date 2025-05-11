// Store references to current elements
let currentFloatingBar = null;
let currentCommentBox = null;
let currentPostText = '';
let isLoading = false;
let selectedTone = 'professional';
let currentPlatform = 'linkedin'; // 'linkedin' or 'twitter'

// Define consistent light theme styles (background, border, etc.)
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

// HTML for the floating bar UI (tone buttons, generate, clear, etc.)
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

// Handle the floating bar display and interaction
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

    // Detect platform (Twitter/X or LinkedIn)
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

// Extract the text of the post to generate a comment for
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

// Generate an AI comment using the Gemini API directly
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

    const prompt = `You are a social media engagement assistant.
    ${toneInstructions[tone]}
    ${platformSpecific[platform]}
    Respond naturally to this post in 1-2 short sentences max.

    Post content: "${postText.trim()}"

    Generated ${tone} comment:`;

    // Use the provided Gemini API endpoint with the API key
    // For testing, we can hardcode the endpoint with the provided API key
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyAfaYHt0OLRCf6w1NKoelKxypfOK7DLzGI';

    // Alternatively, use the dynamically fetched API key (uncomment this line and comment the hardcoded one above once confirmed working)
    // const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header needed; the API key is in the URL
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: tone === 'funny' ? 0.7 : 0.5
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error Response:', errorData);
      if (response.status === 429) {
        throw new Error('Rate limit exceeded: ' + (errorData.error?.message || 'Unknown rate limit error'));
      }
      throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('API Response from Gemini:', data);

    if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      throw new Error('Invalid API response: No candidates array found');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
      throw new Error('Invalid API response: No text content found');
    }

    let comment = candidate.content.parts[0].text.trim();

    if (comment.startsWith('"') && comment.endsWith('"')) {
      comment = comment.slice(1, -1);
    }

    if (platform === 'twitter' && comment.length > 280) {
      comment = comment.substring(0, 277) + '...';
    }

    return comment;
  } catch (error) {
    console.error('Error generating AI comment:', error);
    throw error;
  }
}

// Retrieve the Google AI Studio API key from storage
async function getAPIKey() {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['googleApiKey'], (result) => {
        console.log('Retrieved API key:', result); // Debug log to verify key retrieval
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.googleApiKey || null);
        }
      });
    } else {
      resolve(localStorage.getItem('googleApiKey') || null);
    }
  });
}

// Show a warning if the API key is not set
function showAPIKeyWarning() {
  if (currentFloatingBar && !currentFloatingBar.querySelector('.api-key-warning')) {
    const warning = document.createElement('div');
    warning.className = 'api-key-warning';
    warning.textContent = 'Please set your Google AI Studio API key in extension options';
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
      if (typeof chrome !== 'undefined' && chrome.runtime) {
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

// Find the comment box element on the page
function findCommentBox(element) {
  if (!element) return null;

  if (element.closest('.choosyai-bar')) {
    return currentCommentBox;
  }

  if (window.location.hostname.includes('twitter.com') ||
      window.location.hostname.includes('x.com')) {
    const tweetBoxContainer = element.closest('[data-testid="tweetTextarea_0"]') ||
                              element.closest('[role="textbox"]') ||
                              document.querySelector('[data-testid="tweetTextarea_0"]');

    const tweetBox = tweetBoxContainer?.querySelector('div[contenteditable="true"]') ||
                     tweetBoxContainer?.querySelector('div[role="textbox"]') ||
                     tweetBoxContainer ||
                     document.querySelector('[data-testid="tweetTextarea_0"] div[contenteditable="true"]');

    console.log('Twitter Comment Box Detection:', tweetBoxContainer, 'Final Box:', tweetBox);
    return tweetBox || null;
  }

  const commentBox = element.closest('.comments-comment-box, .comment-input')?.querySelector(
    '.comments-comment-box__editor, [role="textbox"], .ql-editor, .ql-editor.ql-blank'
  ) || element;

  return (commentBox?.classList?.contains('comments-comment-box__editor') ||
          commentBox?.getAttribute('role') === 'textbox' ||
          commentBox?.classList?.contains('ql-editor'))
          ? commentBox : null;
}

// Insert the generated comment into the comment box
function insertComment(commentBox, text) {
  if (!commentBox || !text) {
    console.error('Insert Comment Failed: No comment box or text provided');
    return;
  }

  try {
    console.log('Inserting Comment into:', commentBox, 'Text:', text);

    // Clear the comment box completely before inserting new text
    clearCommentBox(commentBox);

    commentBox.focus();

    if (currentPlatform === 'twitter') {
      if (commentBox.isContentEditable) {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);

        const beforeInputEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          dataTransfer: clipboardData
        });

        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboardData
        });

        const beforeInputPrevented = !commentBox.dispatchEvent(beforeInputEvent);
        if (beforeInputPrevented) {
          console.warn('beforeinput event was prevented');
        }

        const pastePrevented = !commentBox.dispatchEvent(pasteEvent);
        if (pastePrevented) {
          console.warn('paste event was prevented, falling back to execCommand');
          document.execCommand('insertText', false, text); // Fallback for prevented paste
        } else {
          const range = document.createRange();
          range.selectNodeContents(commentBox);
          range.deleteContents();

          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          range.collapse(false);

          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }

        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
        commentBox.dispatchEvent(new Event('compositionend', { bubbles: true }));

        console.log('Comment Inserted Successfully:', commentBox.textContent);
      } else if (commentBox.tagName === 'TEXTAREA' || commentBox.getAttribute('role') === 'textbox') {
        commentBox.value = text;
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.warn('Unknown comment box type for Twitter:', commentBox);
        commentBox.textContent = text;
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
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
    commentBox.innerHTML = '';
    const textNode = document.createTextNode(text);
    commentBox.appendChild(textNode);
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    commentBox.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Clear the comment box before inserting a new comment
function clearCommentBox(commentBox) {
  if (!commentBox) return;

  try {
    commentBox.focus();

    if (currentPlatform === 'twitter') {
      if (commentBox.isContentEditable) {
        // Clear all content and child nodes
        commentBox.innerHTML = '';
        const childNodes = commentBox.childNodes;
        while (childNodes.length > 0) {
          childNodes[0].remove();
        }

        // Simulate a deleteContent event to reset editor state
        const deleteEvent = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'deleteContent'
        });
        commentBox.dispatchEvent(deleteEvent);

        // Select all content and delete
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(commentBox);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete', false, null);
        range.collapse(true);
        selection.removeAllRanges();

        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
        commentBox.dispatchEvent(new Event('compositionend', { bubbles: true }));
      } else if (commentBox.tagName === 'TEXTAREA' || commentBox.getAttribute('role') === 'textbox') {
        commentBox.value = '';
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      console.log('After clearing (Twitter):', commentBox.innerHTML, commentBox.textContent);
    } else if (commentBox.classList.contains('ql-editor')) {
      commentBox.innerHTML = '';
    } else {
      commentBox.textContent = '';
    }

    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  } catch (error) {
    console.error('Error clearing comment box:', error);
  }
}

// Event listeners for focus and click to detect comment box
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

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('beforeunload', () => {
  if (currentFloatingBar && currentFloatingBar.parentNode) {
    currentFloatingBar.parentNode.removeChild(currentFloatingBar);
  }
});
