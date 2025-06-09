const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');
const statusCampos = [];

async function executarCadastroCRLV() {
  console.log('🧠 Robô CRLV iniciado');

  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
  } catch (e) {
    console.log('⛔ Robô já em execução.');
    return;
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('🔐 Login...');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    console.log('📁 Acessando CRLV...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('CRLV', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');

    const dados = {
      'Placa': 'GKD0F82',
      'CHASSI': '9C2KF4300NR006285',
      'RENAVAM': '01292345630',
      'Estado de emplacamento': 'SP',
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const label = await page.getByLabel(campo);
        await label.scrollIntoViewIfNeeded();
        await label.fill(valor);
        console.log(`✅ ${campo}`);
        statusCampos.push(`✅ ${campo}`);
      } catch {
        console.log(`❌ ${campo}`);
        statusCampos.push(`❌ ${campo}`);
      }
    }

    const arquivoCRLV = {
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      local: 'crlv_temp.pdf',
      label: '* CRLV'
    };

    const localPath = path.resolve(__dirname, arquivoCRLV.local);
    await baixarArquivo(arquivoCRLV.url, localPath);
    if (fs.existsSync(localPath)) {
      await enviarArquivo(page, 0, arquivoCRLV.label, localPath);
    }

    await page.waitForTimeout(3000);

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        console.log(`✅ Registro CRLV criado`);
        break;
      }
    }

    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'registro_crlv.png' });

    fs.writeFileSync('status_crlv.txt', statusCampos.join('\n'));
    await browser.close();
  } catch (err) {
    const msg = '❌ Erro: ' + err.message;
    console.log(msg);
    statusCampos.push(msg);
    fs.writeFileSync('status_crlv.txt', statusCampos.join('\n'));
  }

  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

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

async function enviarArquivo(page, index, labelTexto, arquivoLocal) {
  try {
    const nomeArquivo = path.basename(arquivoLocal);
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(index);

    await botao.scrollIntoViewIfNeeded();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.click()
    ]);

    await fileChooser.setFiles(arquivoLocal);
    await page.waitForTimeout(3000);

    const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
    if (sucesso) {
      console.log(`✅ ${labelTexto} enviado`);
      statusCampos.push(`✅ ${labelTexto} enviado`);
    } else {
      statusCampos.push(`❌ ${labelTexto} falhou`);
    }
  } catch {
    statusCampos.push(`❌ Falha ao enviar ${labelTexto}`);
  }
}

app.get('/', (req, res) => {
  res.send('<h2>Robô de cadastro CRLV ativo.</h2><p><a href="/start-crlv">Iniciar cadastro CRLV</a></p>');
});

app.get('/start-crlv', async (req, res) => {
  res.send('<p>✅ Robô CRLV iniciado. Acompanhe os logs no Railway.</p>');
  await executarCadastroCRLV();
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
