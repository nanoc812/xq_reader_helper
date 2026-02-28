chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    const articleElement = document.querySelector('.article__bd__detail');
    if (articleElement) {
      sendResponse({ success: true, content: articleElement.innerText });
    } else {
      sendResponse({ success: false, content: null });
    }
  }
  return true;
});
