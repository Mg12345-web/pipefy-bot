// ARQUIVO ATUALIZADO: Cadastro simultâneo de Cliente e CRLV

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require('express');

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');
const statusCampos = [];

async function executarRobo() {
  console.log('🧠 Função executarRobo() iniciada...');
  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
    console.log(`🔒 Lock criado com sucesso em: ${LOCK_PATH} (PID: ${process.pid})`);
  } catch (e) {
    console.log('⛔ Robô já está em execução. Lock já existe.');
    return;
  }

  try {
    console.log('🔄 Iniciando robô automaticamente após deploy...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    const pageLogin = await context.newPage();
    console.log('🔐 Acessando login...');
    await pageLogin.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await pageLogin.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await pageLogin.click('#kc-login');
    await pageLogin.fill('input[name="password"]', 'Mg.12345@');
    await pageLogin.click('#kc-login');
    await pageLogin.waitForNavigation({ waitUntil: 'load' });

    const paginaCliente = await context.newPage();
    const paginaCRLV = await context.newPage();

    await Promise.all([
      cadastrarCliente(paginaCliente),
      cadastrarCRLV(paginaCRLV)
    ]);

    await browser.close();
  } catch (err) {
    const msg = '❌ Erro durante execução: ' + err.message;
    console.log(msg);
    statusCampos.push(msg);
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
  }

  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

async function cadastrarCliente(page) {
  console.log('📁 Acessando banco Clientes...');
  await page.goto('https://app.pipefy.com/');
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
    'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG',
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

  const arquivos = [
    { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', local: 'cnh_teste.pdf', label: '* CNH' },
    { url: 'https://www.africau.edu/images/default/sample.pdf', local: 'proc_teste.pdf', label: '* Procuração' }
  ];

  for (let i = 0; i < arquivos.length; i++) {
    const file = path.resolve(__dirname, arquivos[i].local);
    await baixarArquivo(arquivos[i].url, file);
    if (fs.existsSync(file)) {
      await enviarArquivoPorOrdem(page, i, arquivos[i].label, file, statusCampos);
    }
  }

  const botoes = await page.$$('button');
  for (let i = 0; i < botoes.length; i++) {
    const texto = await botoes[i].innerText();
    const box = await botoes[i].boundingBox();
    if (texto.trim() === 'Criar registro' && box && box.width > 200) {
      await botoes[i].scrollIntoViewIfNeeded();
      await botoes[i].click();
      statusCampos.push(`✅ Botão Cliente ${i + 1} clicado com sucesso.`);
      break;
    }
  }

  statusCampos.push('✅ Registro cliente criado com sucesso');
}

async function cadastrarCRLV(page) {
  console.log('📄 Acessando banco CRLV...');
  await page.goto('https://app.pipefy.com/apollo_databases/304722775');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'crlv_01_tela_banco.png' });

  try {
    await page.waitForSelector('button:has-text("Criar registro")', { timeout: 10000 });
    await page.click('button:has-text("Criar registro")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'crlv_02_tela_formulario.png' });
  } catch (err) {
    console.log('❌ Erro ao abrir formulário CRLV');
    statusCampos.push('❌ Erro ao abrir formulário CRLV');
    return;
  }

  const dadosCRLV = {
    'Placa': 'GKD0F82',
    'CHASSI': '9C2KF4300NR006285',
    'RENAVAM': '01292345630',
    'Estado de emplacamento': 'SP',
  };

  for (const [campo, valor] of Object.entries(dadosCRLV)) {
    console.log(`⏳ Preenchendo campo CRLV: ${campo}`);
    try {
      const label = await page.getByLabel(campo);
      await label.scrollIntoViewIfNeeded();
      await label.fill(valor);
      console.log(`✅ ${campo} preenchido`);
      statusCampos.push(`✅ ${campo} preenchido`);
    } catch {
      console.log(`❌ ${campo} não encontrado`);
      statusCampos.push(`❌ ${campo} não encontrado`);
    }
  }

  const crlvPath = path.resolve(__dirname, 'cnh_teste.pdf');
  await enviarArquivoPorOrdem(page, 0, '* CRLV (teste)', crlvPath, statusCampos);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'crlv_03_antes_clique.png' });

  const botoes = await page.$$('button');
  for (let i = 0; i < botoes.length; i++) {
    const texto = await botoes[i].innerText();
    const box = await botoes[i].boundingBox();
    if (texto.trim() === 'Criar registro' && box && box.width > 200) {
      await botoes[i].scrollIntoViewIfNeeded();
      await botoes[i].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'crlv_04_botao_clicado.png' });
      statusCampos.push(`✅ Botão CRLV ${i + 1} clicado com sucesso`);
      break;
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'crlv_05_final.png' });
  statusCampos.push('✅ Registro CRLV criado com sucesso');
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

async function enviarArquivoPorOrdem(page, index, labelTexto, arquivoLocal, statusCampos) {
  try {
    const nomeArquivo = path.basename(arquivoLocal);
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(index);

    await botao.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.click()
    ]);

    await fileChooser.setFiles(arquivoLocal);
    await page.waitForTimeout(3000);

    const sucessoUpload = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
    if (sucessoUpload) {
      await page.waitForTimeout(5000);
      console.log(`✅ ${labelTexto} enviado`);
      statusCampos.push(`✅ ${labelTexto} enviado`);
    } else {
      statusCampos.push(`❌ ${labelTexto} falhou (não visível após envio)`);
    }
  } catch {
    statusCampos.push(`❌ Falha ao enviar ${labelTexto}`);
  }
}

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robô Pipefy</h2>
    <p>Para iniciar o robô, acesse: <a href="/start">/start</a></p>
  `);
});

app.get('/start', async (req, res) => {
  console.log('🌐 Rota /start acessada. Iniciando execução...');
  res.send('<h3>✅ Robô iniciado. Acompanhe os logs no Railway.</h3>');
  await executarRobo();
});

const PRINTS_DIR = __dirname;

app.use('/prints', express.static(PRINTS_DIR));

app.get('/listar-prints', (req, res) => {
  fs.readdir(PRINTS_DIR, (err, files) => {
    if (err) {
      res.status(500).send('Erro ao listar arquivos');
      return;
    }

    const imagens = files.filter(f => f.endsWith('.png'));
    const links = imagens.map(img => `<li><a href="/prints/${img}" target="_blank">${img}</a></li>`).join('');
    res.send(`<h3>🖼️ Prints disponíveis:</h3><ul>${links}</ul>`);
  });
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
