const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');
const statusCampos = [];

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robô Pipefy</h2>
    <p><a href="/start-clientes">Iniciar cadastro de cliente</a></p>
    <p><a href="/start-crlv">Iniciar cadastro de CRLV</a></p>
  `);
});

app.get('/start-clientes', async (req, res) => {
  res.send('<p>✅ Robô de cliente iniciado! Veja os logs no Railway.</p>');
  await executarCadastroCliente();
});

app.get('/start-crlv', async (req, res) => {
  res.send('<p>✅ Robô de CRLV iniciado! Veja os logs no Railway.</p>');
  await executarCadastroCRLV();
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});

async function executarCadastroCliente() {
  // ... aqui entra o código completo de clientes que você já validou ...
  console.log('👤 Cadastro de cliente executado');
}

async function executarCadastroCRLV() {
  console.log('📄 Iniciando CRLV...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');
  await page.waitForNavigation({ waitUntil: 'load' });

  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('CRLV', { exact: true }).click();
  await page.click('button:has-text("Criar registro")');
  await page.waitForTimeout(2000);

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
      console.log(`✅ ${campo}`);
    } catch {
      console.log(`❌ ${campo}`);
    }
  }

  const crlvPath = path.resolve(__dirname, 'cnh_teste.pdf'); // usando dummy por enquanto
  await enviarArquivo(page, 0, '* CRLV (teste)', crlvPath);

  await page.waitForTimeout(3000);

  const botoes = await page.$$('button');
  for (let i = 0; i < botoes.length; i++) {
    const texto = await botoes[i].innerText();
    const box = await botoes[i].boundingBox();
    if (texto.trim() === 'Criar registro' && box && box.width > 200) {
      await botoes[i].scrollIntoViewIfNeeded();
      await botoes[i].click();
      console.log(`✅ Botão Criar Registro clicado`);
      break;
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'registro_crlv.png' });

  await browser.close();
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
    } else {
      console.log(`❌ ${labelTexto} falhou`);
    }
  } catch {
    console.log(`❌ Erro ao enviar ${labelTexto}`);
  }
}
