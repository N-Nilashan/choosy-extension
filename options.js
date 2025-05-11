document.addEventListener('DOMContentLoaded', function() {
  // Load saved API key
  chrome.storage.sync.get(['openRouterApiKey'], function(result) {
    if (result.openRouterApiKey) {
      document.getElementById('apiKey').value = result.openRouterApiKey;
    }
  });

  // Save API key
  document.getElementById('save').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const status = document.getElementById('status');

    if (!apiKey) {
      status.textContent = 'Please enter an API key';
      status.className = 'status error';
      status.style.display = 'block';
      return;
    }

    chrome.storage.sync.set({ openRouterApiKey: apiKey }, function() {
      status.textContent = 'Settings saved successfully!';
      status.className = 'status success';
      status.style.display = 'block';

      // Hide status after 3 seconds
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    });
  });
});
