// cadastro_crlv.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const router = express.Router();
const { baixarArquivo } = require('./utils/baixarArquivo');

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo_crlv.lock');

router.get('/start-crlv', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô CRLV...\n');

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

      log('🔐 Acessando login...');
      await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
      await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
      await page.click('#kc-login');
      await page.fill('input[name="password"]', 'Mg.12345@');
      await page.click('#kc-login');
      await page.waitForNavigation({ waitUntil: 'load' });

      log('📁 Acessando banco CRLV...');
      await page.getByText('Databases', { exact: true }).click();
      await page.getByText('CRLV', { exact: true }).click();
      await page.click('button:has-text("Criar registro")');

      const dados = {
        'Placa': 'GKD0F82',
        'CHASSI': '9C2KF4300NR006285',
        'RENAVAM': '01292345630',
        'Estado de emplacamento': 'SP'
      };

      for (const [campo, valor] of Object.entries(dados)) {
        try {
          const label = await page.getByLabel(campo);
          await label.scrollIntoViewIfNeeded();
          await label.fill(valor);
          log(`✅ ${campo}`);
        } catch {
          log(`❌ ${campo}`);
        }
      }

      const urlArquivo = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      const localPath = path.resolve(__dirname, 'crlv_temp.pdf');
      await baixarArquivo(urlArquivo, localPath);

      const botao = await page.locator('button[data-testid="attachments-dropzone-button"]').nth(0);
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botao.click()
      ]);
      await fileChooser.setFiles(localPath);
      await page.waitForTimeout(3000);

      const botoes = await page.$$('button');
      for (let i = 0; i < botoes.length; i++) {
        const texto = await botoes[i].innerText();
        const box = await botoes[i].boundingBox();
        if (texto.trim() === 'Criar registro' && box && box.width > 200) {
          await botoes[i].scrollIntoViewIfNeeded();
          await botoes[i].click();
          break;
        }
      }

      const screenshotPath = path.resolve(__dirname, 'registro_crlv.png');
      await page.screenshot({ path: screenshotPath });
      log('📸 Print final do CRLV salvo.');

      await browser.close();
      fs.unlinkSync(LOCK_PATH);
      log('✅ Robô CRLV finalizado com sucesso!');
      res.end('</pre><p><b>✅ Processo CRLV concluído.</b></p>');
    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      if (browser) await browser.close();
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
      res.end('</pre><p style="color:red"><b>❌ Erro ao executar robô CRLV.</b></p>');
    }
  }, 60000);
});

module.exports = router;
