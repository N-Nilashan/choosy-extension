const API_ENDPOINT = 'https://api.openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT = 15000; // 15 seconds

let isRateLimited = false;
let rateLimitResetTime = 0;

async function handleGenerateComment(request) {
  try {
    // Check rate limiting
    if (isRateLimited) {
      const timeLeft = rateLimitResetTime - Date.now();
      if (timeLeft > 0) {
        throw new Error(`Rate limited. Please try again in ${Math.ceil(timeLeft/1000)} seconds`);
      }
      isRateLimited = false;
    }

    const { openRouterApiKey } = await chrome.storage.local.get(['openRouterApiKey']);
    if (!openRouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'AI Comment Generator'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [{
          role: 'user',
          content: `Generate a ${request.tone} comment responding to: "${request.postText}"`
        }],
        max_tokens: 200
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle rate limiting
    if (response.status === 429) {
      const resetTime = response.headers.get('x-ratelimit-reset') ||
                       Math.floor(Date.now() / 1000) + 60;
      rateLimitResetTime = resetTime * 1000;
      isRateLimited = true;
      throw new Error(`Rate limited. Please try again in ${resetTime - Math.floor(Date.now()/1000)} seconds`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Background script error:', error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateComment') {
    handleGenerateComment(request)
      .then(response => sendResponse({ generatedText: response.choices?.[0]?.message?.content }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep the message port open for async response
  }
});
