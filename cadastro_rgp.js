const { chromium } = require('playwright');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

function baixarArquivo(url, destino) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destino);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(destino, () => reject(err));
    });
  });
}

// ➕ NOVA ROTA: /start-rgp
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
      await page.waitForSelector('button:has-text("Create new card")', { timeout: 10000 });

     const botoes = await page.$$('button');
let encontrou = false;

for (const botao of botoes) {
  const texto = await botao.innerText();
  const box = await botao.boundingBox();

  if (texto.trim() === 'Create new card' && box && box.width > 200) {
    await botao.scrollIntoViewIfNeeded();

    const highlightBox = await page.evaluateHandle((element) => {
      const rect = element.getBoundingClientRect();
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = `${rect.top + window.scrollY}px`;
      div.style.left = `${rect.left + window.scrollX}px`;
      div.style.width = `${rect.width}px`;
      div.style.height = `${rect.height}px`;
      div.style.border = '4px solid red';
      div.style.zIndex = '9999';
      div.id = 'debug-highlight';
      document.body.appendChild(div);
      return div;
    }, botao);

    const screenshotPathBtn = path.resolve(__dirname, 'botao_create_new_card.png');
    await page.screenshot({ path: screenshotPathBtn });
    log('📸 Print do botão capturado: botao_create_new_card.png');

    await page.evaluate(() => {
      const el = document.getElementById('debug-highlight');
      if (el) el.remove();
    });

    await botao.click();
    log('✅ Botão correto clicado');
    encontrou = true;
    break;
  }
}

if (!encontrou) {
  log('❌ Botão "Create new card" não encontrado ou bloqueado por outro elemento.');
}

      log('👤 Selecionando cliente...');
      await page.locator('div:has-text("Cliente")').getByText('Criar registro').click();
      await page.locator('input[placeholder*="cards pelo título"]').fill('039.325.432-11');
      await page.waitForTimeout(1000);
      await page.getByText('LEONARDO GARCIA DE BRITO').click();

      log('🚗 Selecionando veículo...');
      await page.locator('div:has-text("Veículo")').getByText('Criar registro').click();
      await page.locator('input[placeholder*="cards pelo título"]').fill('SHU4H96');
      await page.waitForTimeout(1000);
      await page.getByText('SHU4H96').click();

      log('✍️ Preenchendo dados...');
      await page.getByLabel('AIT').fill('uyhvbkiuhn');
      await page.getByLabel('Órgão').fill('PRF');
      await page.getByLabel('Prazo para Protocolo').fill('2025-06-08T12:00');

      log('📎 Enviando documento...');
      const fileURL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      const localPath = path.resolve(__dirname, 'rgp_doc.pdf');
      await baixarArquivo(fileURL, localPath);
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByText('Adicionar novos arquivos').click()
      ]);
      await fileChooser.setFiles(localPath);

      await page.waitForTimeout(2000);

      const botoesCriar = await page.$$('button');
      for (const botao of botoesCriar) {
        const texto = await botao.innerText();
        const box = await botao.boundingBox();
        if (texto.trim() === 'Criar registro' && box && box.width > 200) {
          await botao.scrollIntoViewIfNeeded();
          await botao.click();
          log('✅ Registro criado com sucesso');
          break;
        }
      }

      const screenshotPath = path.resolve(__dirname, 'print_rgp.png');
      await page.waitForTimeout(4000);
      await page.screenshot({ path: screenshotPath });
      await browser.close();

      log('✅ Cadastro RGP realizado com sucesso!');
      res.write('</pre><h3>🖼️ Print final:</h3>');
      const base64img = fs.readFileSync(screenshotPath).toString('base64');
      res.write(`<img src="data:image/png;base64,${base64img}" style="max-width:100%; border:1px solid #ccc;">`);
      res.end();

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
