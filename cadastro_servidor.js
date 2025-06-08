const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robô Pipefy - Cadastro de Cliente</h2>
    <form action="/cliente" method="GET">
      <button type="submit" style="font-size: 18px; padding: 10px 20px;">
        Iniciar cadastro de cliente
      </button>
    </form>
  `);
});

app.get('/cliente', async (req, res) => {
  res.send('<p>✅ Cadastro de cliente iniciado! Veja os logs no Railway.</p>');
  executarCadastroCliente();
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});

async function iniciarComLogin() {
  console.log('🧪 Iniciando Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  console.log('✅ Chromium iniciado.');
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 Realizando login no Pipefy...');
  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });

  return { browser, page };
}

async function executarCadastroCliente() {
  console.log('🚀 Iniciando cadastro de cliente com login embutido...');

  const { browser, page } = await iniciarComLogin();

  await page.goto('https://app.pipefy.com/apollo_databases/304722696');
  await page.waitForSelector('button:has-text("Criar registro")', { timeout: 10000 });
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
      console.log(`✅ ${campo} preenchido`);
    } catch {
      console.log(`❌ ${campo} não encontrado`);
    }
  }

  const botoes = await page.$$('button');
  for (let i = 0; i < botoes.length; i++) {
    const texto = await botoes[i].innerText();
    const box = await botoes[i].boundingBox();
    if (texto.trim() === 'Criar registro' && box && box.width > 200) {
      await botoes[i].scrollIntoViewIfNeeded();
      await botoes[i].click();
      console.log(`✅ Botão Criar Registro clicado com sucesso`);
      break;
    }
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'registro_cliente.png' });

  console.log('✅ Cadastro de cliente concluído com sucesso!');
  await browser.close();
}
