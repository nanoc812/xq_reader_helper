let systemPrompt = '';
let isAnalyzing = false;
let inputFocused = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadSystemPrompt();
  await loadLastResult();
  
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'settings.html' });
  });
  
  document.getElementById('analyzeBtn').addEventListener('click', handleAnalyze);
  
  const apiProviderEl = document.getElementById('apiProvider');
  if (apiProviderEl) {
    apiProviderEl.addEventListener('change', updateModelName);
  }
  
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', handleModeChange);
  });
  
  const inputText = document.getElementById('inputText');
  if (inputText) {
    inputText.addEventListener('focus', () => {
      inputFocused = true;
    });
  }
});

function handleModeChange() {
  const inputText = document.getElementById('inputText');
  if (inputFocused && inputText) {
    inputText.value = '';
    inputFocused = false;
  }
}

async function loadSystemPrompt() {
  try {
    const response = await fetch('cw_Prompt.md');
    if (!response.ok) {
      throw new Error('Failed to load prompt file');
    }
    systemPrompt = await response.text();
  } catch (error) {
    console.error('加载Prompt失败:', error);
    showStatus('警告: 无法加载Prompt文件，使用默认配置', 'error');
    systemPrompt = '你是一个专业的财经分析助手，请分析用户提供的文章内容。';
  }
}

async function loadLastResult() {
  try {
    const result = await chrome.storage.local.get('lastResult');
    if (result.lastResult) {
      renderMarkdown(result.lastResult);
    }
  } catch (error) {
    console.error('加载上次结果失败:', error);
  }
}

async function handleAnalyze() {
  if (isAnalyzing) return;
  
  const inputText = document.getElementById('inputText').value.trim();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  
  if (!inputText) {
    showStatus('请输入需要分析的文本内容', 'error');
    return;
  }
  
  const settings = await chrome.storage.local.get(['apiProvider', 'apiKey', 'modelName', 'enableWebSearch']);
  
  if (!settings.apiKey) {
    showStatus('请先在设置页面配置API Key', 'error');
    return;
  }
  
  isAnalyzing = true;
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '分析中...';
  
  showStatus('正在分析...', '');
  showLoading();
  
  try {
    let contentToAnalyze = inputText;
    
    if (mode === 'long') {
      showStatus('正在获取网页内容...', '');
      const pageContentResult = await getPageContent();
      if (pageContentResult && pageContentResult.success) {
        showStatus(`已获取网页内容 (${pageContentResult.selector})，正在调用大模型...`, '');
        contentToAnalyze = `用户输入内容：\n${inputText}\n\n网页文章内容：\n${pageContentResult.content}`;
      } else {
        const errorMsg = pageContentResult ? pageContentResult.error : '未知错误';
        showStatus(`无法获取网页内容，仅分析用户输入 (${errorMsg})`, 'error');
      }
    }
    
    showStatus('正在调用大模型分析...', '');
    await streamAnalyze(contentToAnalyze, settings);
    
    showStatus('分析完成', 'success');
  } catch (error) {
    console.error('分析失败:', error);
    showStatus(`分析失败: ${error.message}`, 'error');
    document.getElementById('resultContent').innerHTML = `<div class="placeholder" style="color: #d32f2f;">分析失败: ${error.message}</div>`;
  } finally {
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '分析';
  }
}

async function getPageContent() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0] || !tabs[0].url.includes('xueqiu.com')) {
        resolve({ success: false, error: '当前页面不是雪球网站' });
        return;
      }
      
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const selectors = [
              '.article__bd__detail',
              '.stock-detail_cnt',
              '.article-content',
              '.article__content',
              '.detail__content',
              '#detail-content',
              '.xq_text',
              '[class*="article"] [class*="detail"]',
              '[class*="content"]'
            ];
            
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element.innerText && element.innerText.trim().length > 100) {
                return selector;
              }
            }
            return null;
          }
        });
        
        if (results && results[0] && results[0].result) {
          const matchedSelector = results[0].result;
          
          const contentResults = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (selector) => {
              const element = document.querySelector(selector);
              if (element) {
                return element.innerText;
              }
              return null;
            },
            args: [matchedSelector]
          });
          
          if (contentResults && contentResults[0] && contentResults[0].result) {
            const text = contentResults[0].result.trim();
            if (text.length > 100) {
              resolve({ success: true, content: text, selector: matchedSelector });
              return;
            }
          }
        }
        
        resolve({ success: false, error: '无法获取页面内容，请确保当前在雪球文章详情页' });
      } catch (error) {
        console.error('获取页面内容失败:', error);
        resolve({ success: false, error: '获取页面内容失败: ' + error.message });
      }
    });
  });
}

async function streamAnalyze(content, settings) {
  const { apiProvider, apiKey, modelName, enableWebSearch } = settings;
  
  let apiUrl, headers, requestBody;
  
  if (apiProvider === 'kimi') {
    apiUrl = 'https://api.moonshot.cn/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    requestBody = {
      model: modelName || 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.7,
      stream: true
    };
  } else if (apiProvider === 'qwen') {
    apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-SSE': 'enable'
    };
    
    const qwenParams = {
      model: modelName || 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ]
      },
      parameters: {
        temperature: 0.7,
        result_format: 'message'
      }
    };
    
    if (enableWebSearch) {
      qwenParams.parameters.enable_search = true;
    }
    
    requestBody = qwenParams;
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API请求失败: ${response.status} - ${errorText}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';
  
  const resultContent = document.getElementById('resultContent');
  resultContent.innerHTML = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const json = JSON.parse(data);
          let content = '';
          
          if (apiProvider === 'kimi') {
            content = json.choices?.[0]?.delta?.content || '';
          } else if (apiProvider === 'qwen') {
            content = json.output?.choices?.[0]?.message?.content || 
                      json.output?.choices?.[0]?.delta?.content || '';
          }
          
          if (content) {
            fullContent += content;
            renderMarkdownStreaming(fullContent);
          }
        } catch (e) {
          console.log('解析SSE数据失败:', e);
        }
      }
    }
  }
  
  if (fullContent) {
    await chrome.storage.local.set({ lastResult: fullContent });
  }
}

function parseMarkdown(text) {
  let html = text;
  
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = escapeHtml(code.trim());
    return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
  });
  
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  html = html.replace(/^\| (.+) \|$/gm, (match, content) => {
    const cells = content.split(' | ').map(cell => cell.trim());
    const isSeparator = cells.every(cell => /^[-:]+$/.test(cell));
    if (isSeparator) return '';
    return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
  });
  
  let inTable = false;
  const lines = html.split('\n');
  const processedLines = [];
  let currentTable = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('<tr>')) {
      if (!inTable) {
        inTable = true;
        currentTable = [];
      }
      if (line !== '') {
        currentTable.push(line);
      }
    } else {
      if (inTable) {
        if (currentTable.length > 0) {
          const hasHeader = currentTable.length > 1;
          let tableHtml = '<table>';
          currentTable.forEach((row, idx) => {
            if (hasHeader && idx === 0) {
              tableHtml += '<thead>' + row.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>') + '</thead><tbody>';
            } else {
              tableHtml += row;
            }
          });
          tableHtml += '</tbody></table>';
          processedLines.push(tableHtml);
        }
        currentTable = [];
        inTable = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inTable && currentTable.length > 0) {
    const hasHeader = currentTable.length > 1;
    let tableHtml = '<table>';
    currentTable.forEach((row, idx) => {
      if (hasHeader && idx === 0) {
        tableHtml += '<thead>' + row.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>') + '</thead><tbody>';
      } else {
        tableHtml += row;
      }
    });
    tableHtml += '</tbody></table>';
    processedLines.push(tableHtml);
  }
  
  html = processedLines.join('\n');
  
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  html = html.replace(/<br\s*\/?>/gi, '<br>');
  
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  html = html.replace(/<h([1-6])>(.+?)<\/h\1>/g, '</p><h$1>$2</h$1><p>');
  html = html.replace(/<pre>/g, '</p><pre>');
  html = html.replace(/<\/pre>/g, '</pre><p>');
  html = html.replace(/<ul>/g, '</p><ul>');
  html = html.replace(/<\/ul>/g, '</ul><p>');
  html = html.replace(/<blockquote>/g, '</p><blockquote>');
  html = html.replace(/<\/blockquote>/g, '</blockquote><p>');
  html = html.replace(/<table>/g, '</p><table>');
  html = html.replace(/<\/table>/g, '</table><p>');
  
  html = '<p>' + html + '</p>';
  
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(\s*)<\/p>/g, '');
  html = html.replace(/<p>(\s*<br>\s*)<\/p>/g, '');
  
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdownStreaming(content) {
  const resultContent = document.getElementById('resultContent');
  try {
    resultContent.innerHTML = parseMarkdown(content);
    resultContent.scrollTop = resultContent.scrollHeight;
  } catch (error) {
    resultContent.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  }
}

function renderMarkdown(content) {
  const resultContent = document.getElementById('resultContent');
  try {
    resultContent.innerHTML = parseMarkdown(content);
  } catch (error) {
    resultContent.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  }
}

function showStatus(message, type) {
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  statusText.textContent = message;
  statusBar.className = 'status-bar ' + type;
}

function showLoading() {
  const resultContent = document.getElementById('resultContent');
  resultContent.innerHTML = '<div class="loading"></div>';
}

function updateModelName() {
  const provider = document.getElementById('apiProvider').value;
  const modelNameInput = document.getElementById('modelName');
  
  if (provider === 'kimi') {
    modelNameInput.placeholder = 'moonshot-v1-8k / moonshot-v1-32k / moonshot-v1-128k';
  } else if (provider === 'qwen') {
    modelNameInput.placeholder = 'qwen-turbo / qwen-plus / qwen-max';
  }
}
