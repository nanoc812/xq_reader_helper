document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  
  document.getElementById('apiProvider').addEventListener('change', handleProviderChange);
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('backBtn').addEventListener('click', () => {
    window.close();
  });
  
  const customPromptEl = document.getElementById('customPrompt');
  const promptCountEl = document.getElementById('promptCount');
  customPromptEl.addEventListener('input', () => {
    const len = customPromptEl.value.length;
    promptCountEl.textContent = `${len}/5000`;
    if (len > 5000) {
      promptCountEl.style.color = '#d32f2f';
    } else {
      promptCountEl.style.color = '';
    }
  });
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(['apiProvider', 'apiKey', 'modelName', 'enableWebSearch', 'customPrompt']);
    
    if (settings.apiProvider) {
      document.getElementById('apiProvider').value = settings.apiProvider;
    }
    if (settings.apiKey) {
      document.getElementById('apiKey').value = settings.apiKey;
    }
    if (settings.modelName) {
      document.getElementById('modelName').value = settings.modelName;
    }
    document.getElementById('enableWebSearch').checked = settings.enableWebSearch !== false;
    if (settings.customPrompt) {
      document.getElementById('customPrompt').value = settings.customPrompt;
      document.getElementById('promptCount').textContent = `${settings.customPrompt.length}/5000`;
    }
    
    handleProviderChange();
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

function handleProviderChange() {
  const provider = document.getElementById('apiProvider').value;
  const modelNameInput = document.getElementById('modelName');
  
  if (provider === 'kimi') {
    modelNameInput.placeholder = 'moonshot-v1-8k (默认)';
    if (!modelNameInput.value) {
      modelNameInput.value = 'moonshot-v1-8k';
    }
  } else if (provider === 'qwen') {
    modelNameInput.placeholder = 'qwen-turbo (默认)';
    if (!modelNameInput.value) {
      modelNameInput.value = 'qwen-turbo';
    }
  }
}

async function saveSettings() {
  const provider = document.getElementById('apiProvider').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  const modelName = document.getElementById('modelName').value.trim();
  const enableWebSearch = document.getElementById('enableWebSearch').checked;
  const customPrompt = document.getElementById('customPrompt').value.trim();
  
  if (!apiKey) {
    showStatus('请输入API Key', 'error');
    return;
  }
  
  try {
    await chrome.storage.local.set({
      apiProvider: provider,
      apiKey: apiKey,
      modelName: modelName,
      enableWebSearch: enableWebSearch,
      customPrompt: customPrompt
    });
    
    showStatus('设置保存成功！', 'success');
  } catch (error) {
    console.error('保存设置失败:', error);
    showStatus('保存失败: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  
  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 3000);
}
