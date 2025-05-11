// Add this at the top of options.js
function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, message: "No API key provided" };
  }

  // Remove any whitespace
  const cleanedKey = apiKey.trim();

  // Accept both v1 keys (sk-or-v1-) and standard keys (sk-or-)
  if (!cleanedKey.startsWith('sk-or-')) {
    return { valid: false, message: "Key must start with 'sk-or-'" };
  }

  // Updated length validation
  if (cleanedKey.length < 30) {
    return { valid: false, message: "Key too short (min 30 characters)" };
  }

  // Remove maximum length restriction
  // if (cleanedKey.length > 64) {
  //   return { valid: false, message: "Key too long (max 64 characters)" };
  // }

  if (!/^sk-or-[a-zA-Z0-9-]+$/.test(cleanedKey)) {
    return { valid: false, message: "Key contains invalid characters" };
  }

  return { valid: true, key: cleanedKey };
}

// Then the rest of your existing options.js code
document.addEventListener('DOMContentLoaded', function() {
  // Load saved API key
  chrome.storage.sync.get(['openRouterApiKey'], function(result) {
    if (result.openRouterApiKey) {
      document.getElementById('apiKey').value = result.openRouterApiKey;
    }
  });

  // Real-time validation
  document.getElementById('apiKey').addEventListener('input', function(e) {
    const keyInput = e.target;
    const errorDisplay = document.querySelector('.key-error-message');
    const { valid, message } = validateApiKey(keyInput.value);

    if (valid) {
      keyInput.classList.remove('invalid-key');
      errorDisplay.style.display = 'none';
    } else {
      keyInput.classList.add('invalid-key');
      errorDisplay.textContent = message;
      errorDisplay.style.display = 'block';
    }
  });

  // Save API key
  document.getElementById('save').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const { valid, message } = validateApiKey(apiKey);

    if (!valid) {
      const status = document.getElementById('status');
      status.textContent = `Invalid API key: ${message}`;
      status.className = 'status error';
      status.style.display = 'block';
      return;
    }

    chrome.storage.sync.set({ openRouterApiKey: apiKey }, function() {
      const status = document.getElementById('status');
      status.textContent = 'Settings saved successfully!';
      status.className = 'status success';
      status.style.display = 'block';

      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    });
  });
});
