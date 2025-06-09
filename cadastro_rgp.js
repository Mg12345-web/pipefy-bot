const { chromium } = require('playwright');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

app.get('/start-rgp', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô RGP...\n');

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

      log('🔘 Procurando <span> com texto "Create new card"...');
      const createCard = await page.locator('text=Create new card').first();
      await createCard.scrollIntoViewIfNeeded();
      await createCard.click();
      log('✅ Clique no "Create new card" realizado com sucesso!');

      await browser.close();
      res.end('</pre><p style="color:green">✅ Robô finalizado com sucesso. Botão clicado.</p>');

    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      res.end('</pre><p style="color:red">Erro crítico. Verifique os logs.</p>');
    } finally {
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
    }
  }, 60000); // 1 minuto
});

app.listen(PORT, () => {
  console.log(`🖥️ Robô do Pipe RGP escutando em http://localhost:${PORT}`);
});
