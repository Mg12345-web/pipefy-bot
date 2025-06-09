const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 <b>Robô Pipefy</b></h2>
    <p><a href="/start-clientes">Iniciar cadastro de cliente</a></p>
    <p><a href="/start-crlv">Iniciar cadastro de CRLV</a></p>
    <p><a href="/print-crlv" target="_blank">📸 Ver último print do CRLV</a></p>
  `);
});

app.get('/start-crlv', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CRLV...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
  } catch (e) {
    log('⛔ Robô já em execução.');
    return res.end('</pre>');
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

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

    const fileURL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    const localPath = path.resolve(__dirname, 'crlv_temp.pdf');
    await baixarArquivo(fileURL, localPath);

    const nomeArquivo = path.basename(localPath);
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(0);

    await botao.scrollIntoViewIfNeeded();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.click()
    ]);

    await fileChooser.setFiles(localPath);
    await page.waitForTimeout(3000);

    const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
    if (sucesso) {
      log('✅ Arquivo CRLV enviado');
    } else {
      log('❌ Falha no upload do CRLV');
    }

    await page.waitForTimeout(3000);

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        log('✅ Registro criado');
        break;
      }
    }

    await page.waitForTimeout(4000);
    const screenshotPath = path.resolve(__dirname, 'registro_crlv.png');
    await page.screenshot({ path: screenshotPath });
    log('📸 Capturado print da tela final');

    await browser.close();

    res.write('</pre><h3>🖼️ Print final da tela:</h3>');
    const base64img = fs.readFileSync(screenshotPath).toString('base64');
    res.write(`<img src="data:image/png;base64,${base64img}" style="max-width:100%; border:1px solid #ccc;">`);
    res.end();

  } catch (err) {
    log(`❌ Erro: ${err.message}`);
    res.end('</pre><p style="color:red">Erro crítico. Verifique os logs.</p>');
  } finally {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  }
});

// ========== NOVA ROTA PARA VISUALIZAR PRINT DO CRLV ==========
app.get('/print-crlv', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'registro_crlv.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela do CRLV:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

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

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
