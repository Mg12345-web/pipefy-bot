const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

app.get('/', (req, res) => {
  res.send('<h2>🤖 Robô de cadastro no Pipe RGP</h2><p><a href="/start-rgp">Iniciar cadastro RGP</a></p>');
});

app.get('/start-rgp', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô...\n');
  
  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
  } catch {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  setTimeout(async () => {
    try {
      log('🧠 Iniciando navegador...');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      log('🔐 Realizando login...');
      await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
      await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
      await page.click('#kc-login');
      await page.fill('input[name="password"]', 'Mg.12345@');
      await page.click('#kc-login');
      await page.waitForNavigation({ waitUntil: 'load' });

      log('📂 Acessando Pipe RGP...');
      await page.getByText('RGP', { exact: true }).click();
      await page.waitForTimeout(3000);

      const screenshotPath = path.resolve(__dirname, 'rgp_acesso.png');
      await page.screenshot({ path: screenshotPath });
      log('📸 Print da tela do Pipe RGP capturado');

      await browser.close();

      res.write('</pre><h3>🖼️ Tela do Pipe RGP:</h3>');
      const base64img = fs.readFileSync(screenshotPath).toString('base64');
      res.write(`<img src="data:image/png;base64,${base64img}" style="max-width:100%; border:1px solid #ccc;">`);
      res.end();

    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      res.end('</pre><p style="color:red">Erro crítico. Verifique os logs.</p>');
    } finally {
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
    }
  }, 60000); // ⏱️ Delay de 1 minuto
});

app.listen(PORT, () => {
  console.log(`🖥️ Robô do Pipe RGP escutando em http://localhost:${PORT}`);
});
