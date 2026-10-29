const http = require('http');
const { spawn } = require('child_process');

async function run() {
  console.log('Launching headless Edge...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    'http://localhost:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const tabs = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('5173'));
    if (!pageTab) {
      console.error('No page tab found. Available tabs:', tabs);
      return;
    }

    console.log('Connecting to WebSocket:', pageTab.webSocketDebuggerUrl);
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const handler = (evt) => {
          const res = JSON.parse(evt.data);
          if (res.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(res);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('\n--- UNCAUGHT EXCEPTION IN BROWSER ---');
        console.error(JSON.stringify(msg.params.exceptionDetails, null, 2));
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error' || msg.params.type === 'warning') {
          console.log(`[Console ${msg.params.type.toUpperCase()}]:`, ...msg.params.args.map(a => a.value || a.description));
        }
      }
    };

    await send('Runtime.enable');
    await send('Console.enable');
    await send('Page.enable');

    console.log('Reloading page to capture mount errors...');
    await send('Page.reload', { ignoreCache: true });

    await new Promise(r => setTimeout(r, 3500));

    const evalRes = await send('Runtime.evaluate', {
      expression: `
        JSON.stringify({
          title: document.title,
          rootChildCount: document.getElementById('root')?.childElementCount,
          rootTextLength: document.getElementById('root')?.innerText?.length,
          rootHtmlSnippet: document.getElementById('root')?.innerHTML?.substring(0, 400),
          bodyBackground: window.getComputedStyle(document.body).backgroundColor,
          visibleModalCount: document.querySelectorAll('.modal-backdrop, .auth-modal-card, .architecture-modal-container').length
        })
      `
    });

    console.log('\n--- DOM EVALUATION RESULT ---');
    console.log('evalRes:', JSON.stringify(evalRes, null, 2));

  } catch (err) {
    console.error('Script error:', err);
  } finally {
    edgeProc.kill('SIGKILL');
    process.exit(0);
  }
}

run();
