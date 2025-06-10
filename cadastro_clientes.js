// cadastro_clientes.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const router = express.Router();

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo_clientes.lock');

router.get('/start-clientes', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô de CLIENTES...\n');

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
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      log('🔐 Realizando login...');
      await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
      await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
      await page.click('#kc-login');
      await page.fill('input[name="password"]', 'Mg.12345@');
      await page.click('#kc-login');
      await page.waitForNavigation({ waitUntil: 'load' });

      log('📂 Acessando Database Clientes...');
      await page.goto('https://app.pipefy.com/apollo_databases/304722696');
      await page.waitForTimeout(5000);

      log('🆕 Criando novo registro...');
      await page.click('button:has-text("Criar registro")');
      await page.waitForTimeout(3000);

      log('📸 Capturando print...');
      await page.screenshot({ path: 'print_clientes.png' });

      await browser.close();
      fs.unlinkSync(LOCK_PATH);
      log('✅ Robô CLIENTES finalizado com sucesso!');
      res.end('</pre><p><b>✅ Processo CLIENTES concluído.</b></p>');
    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      if (browser) await browser.close();
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
      res.end('</pre><p style="color:red"><b>❌ Erro ao executar robô CLIENTES.</b></p>');
    }
  }, 60000);
});

module.exports = router;
