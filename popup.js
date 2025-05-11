document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('api-key');
    const saveBtn = document.getElementById('save-btn');
    const statusDiv = document.getElementById('status');

    // Load saved API key if exists
    chrome.runtime.sendMessage({ action: "getApiKey" }, function(response) {
        if (response.apiKey) {
            apiKeyInput.value = response.apiKey;
        }
    });

    // Save API key
    saveBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            statusDiv.textContent = 'Please enter an API key';
            statusDiv.style.color = 'red';
            return;
        }

        chrome.runtime.sendMessage({ action: "saveApiKey", apiKey: apiKey }, function(response) {
            if (response.success) {
                statusDiv.textContent = 'API key saved successfully!';
                statusDiv.style.color = 'green';

                // Clear status after 3 seconds
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            }
        });
    });
});
