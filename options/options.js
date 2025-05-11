document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKeyInput').value.trim();
  if (!apiKey) {
    alert('Please enter a valid API key.');
    return;
  }

  chrome.storage.sync.set({ googleApiKey: apiKey }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving API key:', chrome.runtime.lastError);
      alert('Failed to save API key. Check the console for details.');
      return;
    }

    const status = document.getElementById('status');
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  });
});

// Load the saved API key when the options page is opened
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['googleApiKey'], (result) => {
    if (result.googleApiKey) {
      document.getElementById('apiKeyInput').value = result.googleApiKey;
    }
  });
});
