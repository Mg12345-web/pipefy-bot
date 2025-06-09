const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

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

// ========== Função: Cadastro de Cliente ==========
async function executarCadastroCliente() {
  console.log('👤 Iniciando cadastro de cliente...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginPipefy(page);

  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('Clientes', { exact: true }).click();
  await page.click('button:has-text("Criar registro")');

  const dados = {
    'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
    'CPF OU CNPJ': '414.746.148-41',
    'Estado Civil Atual': 'Solteiro',
    'Profissão': 'Vigilante',
    'Email': 'jonas1gui@gmail.com',
    'Número de telefone': '31988429016',
    'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
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

  const arquivos = [
    { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', local: 'cnh_teste.pdf', label: '* CNH' },
    { url: 'https://www.africau.edu/images/default/sample.pdf', local: 'proc_teste.pdf', label: '* Procuração' }
  ];

  for (let i = 0; i < arquivos.length; i++) {
    const file = path.resolve(__dirname, arquivos[i].local);
    await baixarArquivo(arquivos[i].url, file);
    await enviarArquivo(page, i, arquivos[i].label, file);
  }

  await clicarBotaoCriar(page);
  await page.screenshot({ path: 'registro_cliente.png' });

  await browser.close();
}

// ========== Função: Cadastro de CRLV ==========
async function executarCadastroCRLV() {
  console.log('📄 Iniciando cadastro de CRLV...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginPipefy(page);

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
      console.log(`✅ ${campo}`);
    } catch {
      console.log(`❌ ${campo}`);
    }
  }

  const filePath = path.resolve(__dirname, 'crlv_teste.pdf');
  await baixarArquivo('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', filePath);
  await enviarArquivo(page, 0, '* CRLV', filePath);

  await clicarBotaoCriar(page);
  await page.screenshot({ path: 'registro_crlv.png' });

  await browser.close();
}

// ========== Função: Login ==========
async function loginPipefy(page) {
  console.log('🔐 Login no Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');
  await page.waitForNavigation({ waitUntil: 'load' });
}

// ========== Função: Enviar Arquivo ==========
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
    console.log(`❌ Falha ao enviar ${labelTexto}`);
  }
}

// ========== Função: Baixar Arquivo ==========
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

// ========== Função: Clicar no botão "Criar registro" ==========
async function clicarBotaoCriar(page) {
  const botoes = await page.$$('button');
  for (let i = 0; i < botoes.length; i++) {
    const texto = await botoes[i].innerText();
    const box = await botoes[i].boundingBox();
    if (texto.trim() === 'Criar registro' && box && box.width > 200) {
      await botoes[i].scrollIntoViewIfNeeded();
      await botoes[i].click();
      console.log(`✅ Registro criado`);
      break;
    }
  }
}
