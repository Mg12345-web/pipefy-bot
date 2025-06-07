const { chromium } = require('playwright');
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 8080;

(async () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
  console.log('🔐 Acessando o login do Pipefy...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login feito com sucesso.');

  // Navegar até "Clientes"
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('Clientes', { exact: true }).click();

  // Criar registro (abrir formulário)
  await page.waitForSelector('button:has-text("Criar registro")', { timeout: 15000 });
  await page.click('button:has-text("Criar registro")');

  // Dados para preenchimento
  const dados = {
    'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
    'CPF OU CNPJ': '039.174.906-60',
    'Profissão': 'Vigilante',
    'Email': 'jonas1gui@gmail.com',
    'Número de telefone': '31988429016',
    'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
  };

  for (const [campo, valor] of Object.entries(dados)) {
    await page.getByLabel(campo).fill(valor);
  }

  // Buscar arquivos dinamicamente
  const arquivos = fs.readdirSync(__dirname);
  const arquivoCNH = arquivos.find(nome => nome.toLowerCase().includes('cnh'));
  const arquivosProc = arquivos.filter(nome => 
    nome.toLowerCase().includes('procuracao') || nome.toLowerCase().includes('procuração')
  );

  // Anexar CNH (se encontrado)
  if (arquivoCNH) {
    const inputFiles = await page.$$('input[type="file"]');
    await inputFiles[0].setInputFiles(path.resolve(__dirname, arquivoCNH));
  }

  // Anexar Procurações (se encontrados)
  if (arquivosProc.length > 0) {
    const inputFiles = await page.$$('input[type="file"]');
    await inputFiles[1].setInputFiles(arquivosProc.map(nome => path.resolve(__dirname, nome)));
  }

  // Clicar no botão final de "Criar registro"
  await page.locator('button[data-testid="create-record-fab-button"]').click();

  // Verificar se o formulário fechou (confirmando criação)
  await page.waitForTimeout(3000);
  const formStillOpen = await page.$('input[placeholder="Nome Completo"]');
  if (formStillOpen) {
    console.log('⚠️ O formulário ainda está aberto. O registro pode não ter sido criado.');
  } else {
    console.log('✅ Registro realmente criado com sucesso.');
  }

  await page.screenshot({ path: 'registro_final.png' });
  await browser.close();
})();

app.get('/', (req, res) => {
  res.send(`<h2>✅ Robô executado</h2><p><a href="/print">📥 Baixar print de confirmação</a></p>`);
});

app.get('/print', (req, res) => {
  res.download('registro_final.png');
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
