// Configuration
const MODEL = "mistralai/mistral-7b-instruct:free";
const MAX_TOKENS = 300;
const TEMPERATURE = 0.7;

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

  // Action buttons container (for Generate and Clear)
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

  // Keyboard accessibility for tone buttons
  toneContainer.addEventListener('keydown', (e) => {
    const buttons = Array.from(toneContainer.querySelectorAll('.ai-tone-button'));
    const currentIndex = buttons.findIndex(btn => btn.getAttribute('aria-checked') === 'true');

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % buttons.length;
      buttons[currentIndex].setAttribute('aria-checked', 'false');
      buttons[currentIndex].classList.remove('selected');
      buttons[nextIndex].setAttribute('aria-checked', 'true');
      buttons[nextIndex].classList.add('selected');
      buttons[nextIndex].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      buttons[currentIndex].setAttribute('aria-checked', 'false');
      buttons[currentIndex].classList.remove('selected');
      buttons[prevIndex].setAttribute('aria-checked', 'true');
      buttons[prevIndex].classList.add('selected');
      buttons[prevIndex].focus();
    }
  });

  // Click handler for generate button
  generateButton.addEventListener('click', async () => {
    const selectedTone = toneContainer.querySelector('.ai-tone-button.selected').getAttribute('data-value');
    const originalButtonText = generateButton.textContent;

    generateButton.innerHTML = '<div class="loading"></div>';
    generateButton.disabled = true;
    clearButton.disabled = true;

    try {
      // Get the post content to reply to
      let postContent = '';
      if (window.location.hostname.includes('linkedin')) {
        // LinkedIn specific logic
        const postElement = commentBox.closest('.feed-shared-update-v2') ||
                          commentBox.closest('.feed-shared-update-v2__description-wrapper') ||
                          commentBox.closest('.msg-s-event-listitem');
        if (postElement) {
          postContent = postElement.textContent.trim();
        }
      } else if (window.location.hostname.includes('twitter') || window.location.hostname.includes('x.com')) {
        // Twitter/X specific logic
        const tweetElement = commentBox.closest('[data-testid="tweet"]') ||
                           commentBox.closest('[data-testid="tweetText"]');
        if (tweetElement) {
          postContent = tweetElement.textContent.trim();
        }
      }

      // Get API key from storage
      const { openRouterApiKey } = await chrome.storage.sync.get(['openRouterApiKey']);

      if (!openRouterApiKey) {
        throw new Error('No OpenRouter API key found. Please set it in the extension options.');
      }

      // Generate prompt based on tone and post content
      const prompt = generatePrompt(selectedTone, postContent);

      // Call OpenRouter API
      const reply = await generateAIResponse(prompt, openRouterApiKey);

      // Insert the reply into the comment box
      insertReply(commentBox, reply);

    } catch (error) {
      console.error('Error generating reply:', error);
      showErrorNotification(error.message);
    } finally {
      generateButton.textContent = originalButtonText;
      generateButton.disabled = false;
      clearButton.disabled = false;
    }
  });

  // Click handler for clear button
  clearButton.addEventListener('click', () => {
    clearCommentBox(commentBox);
  });
}

function generatePrompt(tone, postContent) {
  const toneInstructions = {
    professional: "Write a professional, polished response that maintains a formal tone while being respectful.",
    friendly: "Write a warm, approachable response that builds rapport and connection.",
    enthusiastic: "Write an energetic, positive response that shows excitement and engagement.",
    casual: "Write a relaxed, informal response that sounds natural and conversational.",
    formal: "Write a highly structured, proper response using formal language and complete sentences.",
    humorous: "Write a witty, light-hearted response that includes appropriate humor."
  };

  return `You are an expert at crafting social media responses. ${toneInstructions[tone]}

  Original post: "${postContent}"

  Please generate a response that matches the requested tone. Keep it concise (1-2 sentences max). Response:`;
}

async function generateAIResponse(prompt, apiKey) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/your-repo', // Optional for tracking
      'X-Title': 'AI Reply Generator' // Optional for tracking
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to generate response');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
}

function insertReply(commentBox, reply) {
  if (commentBox.tagName === 'TEXTAREA') {
    // For textarea elements (some LinkedIn comment boxes)
    commentBox.value = reply;
    // Trigger input event for React to detect the change
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  } else if (commentBox.hasAttribute('contenteditable')) {
    // For contenteditable divs (most LinkedIn and Twitter/X boxes)
    commentBox.innerHTML = '';
    commentBox.textContent = reply;
    // Dispatch input event for React
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  } else if (commentBox.classList.contains('ql-editor')) {
    // For Quill editors (LinkedIn)
    commentBox.innerHTML = reply;
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  }
}

function clearCommentBox(commentBox) {
  if (commentBox.tagName === 'TEXTAREA') {
    commentBox.value = '';
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  } else if (commentBox.hasAttribute('contenteditable')) {
    commentBox.innerHTML = '';
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  } else if (commentBox.classList.contains('ql-editor')) {
    commentBox.innerHTML = '';
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);
  }
}

function showErrorNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'ai-notification';
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '12px 16px';
  notification.style.backgroundColor = '#ef4444';
  notification.style.color = 'white';
  notification.style.borderRadius = '8px';
  notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  notification.style.zIndex = '100000';
  notification.style.animation = 'slideIn 0.3s forwards';

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}
