const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml'};
function createSandboxServer(){
  return http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if(!file.startsWith(root + path.sep)){ response.writeHead(403).end(); return; }
    try {
      let content = fs.readFileSync(file);
      if(file.endsWith('index.html')) content = Buffer.from(content.toString().replace('window.JTD_PREVIEW_MODE =', 'window.JTD_PREVIEW_MODE = true ||'));
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.setHeader('ETag', '"' + crypto.createHash('sha256').update(content).digest('hex') + '"');
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(404).end(); }
  });
}
async function sandboxContext(browser, options){
  const context = await browser.newContext({...options, serviceWorkers:'block'});
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort();
  });
  return context;
}
module.exports = {createSandboxServer, sandboxContext};
