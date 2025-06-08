const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_cliente.lock');
const statusCampos = [];

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robô Pipefy - Cadastro de Cliente</h2>
    <p>Para iniciar o robô, acesse: <a href="/start">/start</a></p>
  `);
});

app.get('/start', async (req, res) => {
  console.log('🌐 Rota /start acessada. Iniciando execução do cadastro de cliente...');
  res.send('<h3>✅ Robô de cliente iniciado. Veja os logs no Railway.</h3>');
  await executarCadastroCliente();
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});

async function executarCadastroCliente() {
  console.log('🧠 Função executarCadastroCliente() iniciada...');
  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
    console.log(`🔒 Lock criado com sucesso em: ${LOCK_PATH}`);
  } catch (e) {
    console.log('⛔ Robô já está em execução. Lock já existe.');
    return;
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('🔐 Acessando login...');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    console.log('📁 Acessando banco Clientes...');
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

    await page.waitForTimeout(3000);

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        await botoes[i].screenshot({ path: 'print_botao_cliente.png' });
        statusCampos.push(`✅ Botão ${i + 1} clicado com sucesso.`);
        console.log(`✅ Botão ${i + 1} clicado com sucesso.`);
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'registro_cliente_final.png' });
    statusCampos.push('✅ Registro de cliente criado com sucesso');

    await browser.close();
  } catch (err) {
    const msg = '❌ Erro durante execução: ' + err.message;
    console.log(msg);
    statusCampos.push(msg);
  }

  fs.writeFileSync('status_cliente.txt', statusCampos.join('\n'));
  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}
