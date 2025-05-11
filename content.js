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

  // Click handler for generate button (no functionality yet)
  generateButton.addEventListener('click', () => {
    generateButton.innerHTML = '<div class="loading"></div>';
    generateButton.disabled = true;

    // Simulate API call delay
    setTimeout(() => {
      generateButton.textContent = 'Generate AI Reply';
      generateButton.disabled = false;
    }, 1500);
  });

  // Click handler for clear button (no functionality yet)
  clearButton.addEventListener('click', () => {
    clearButton.disabled = true;
    clearButton.innerHTML = '<div class="loading"></div>';

    // Simulate clear action delay
    setTimeout(() => {
      clearButton.textContent = 'Clear';
      clearButton.disabled = false;
    }, 1500);
  });
}

