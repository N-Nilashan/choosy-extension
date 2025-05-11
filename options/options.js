// ChoosyAI Options Page Script
// Handles saving and loading the OpenRouter API key

document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load saved API key
  chrome.storage.sync.get(['apiKey'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Save API key
  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    chrome.storage.sync.set({ apiKey: apiKey }, function() {
      showStatus('API key saved successfully!', 'success');

      // Send message to content script to reload the key
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'reloadApiKey' });
        }
      });
    });
  });

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';

    setTimeout(function() {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
