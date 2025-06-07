const { chromium } = require('playwright');
const express = require('express');
const path = require('path');
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

  // Criar registro
  await page.waitForSelector('button:has-text("Criar registro")');
  await page.click('button:has-text("Criar registro")');

  // Dados para preenchimento
  const dados = {
    'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
    'CPF OU CNPJ': '039.174.906-60',
    'Estado Civil': 'Casado(a)',
    'Profissão': 'Vigilante',
    'Email': 'jonas1gui@gmail.com',
    'Número de telefone': '31988429016',
    'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
  };

  for (const [campo, valor] of Object.entries(dados)) {
    if (campo === 'Estado Civil') {
      await page.getByLabel(campo).click();
      await page.waitForTimeout(500); // espera dropdown carregar
      const opcoes = await page.locator(`div[title="${valor}"]`).first();
      await opcoes.click();
    } else {
      await page.getByLabel(campo).fill(valor);
    }
  }

  // Anexar CNH
  const inputFiles = await page.$$('input[type="file"]');
  await inputFiles[0].setInputFiles(path.resolve(__dirname, 'CNH-e.pdf.pdf'));

  // Anexar 2 arquivos de Procuração
  await inputFiles[1].setInputFiles([
    path.resolve(__dirname, 'PROCURAÇÃO.pdf'),
    path.resolve(__dirname, 'PROCURAÇÃO.pdf')
  ]);

  // Clicar em "Criar registro"
  await page.click('button:has-text("Criar registro")');
  console.log('✅ Registro criado com sucesso.');

  // Esperar e tirar print
  await page.waitForTimeout(4000);
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
