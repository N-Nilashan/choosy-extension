document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const status = document.getElementById('status');

  // Load saved API key
  chrome.storage.sync.get(['openRouterKey'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error loading API key:', chrome.runtime.lastError);
      status.textContent = 'Error loading API key';
      return;
    }
    if (result.openRouterKey) {
      apiKeyInput.value = result.openRouterKey;
    }
  });

  // Save API key
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({ openRouterKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving API key:', chrome.runtime.lastError);
          status.textContent = 'Error saving API key';
          return;
        }
        status.textContent = 'API key saved!';
        setTimeout(() => { status.textContent = ''; }, 2000);
      });
    } else {
      status.textContent = 'Please enter a valid API key!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  });
});
