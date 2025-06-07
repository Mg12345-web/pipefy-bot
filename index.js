const { chromium } = require('playwright');
const express = require('express');
const fs = require('fs');
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
  await page.waitForSelector('input[name="username"]');
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');
  await page.waitForSelector('input[name="password"]');
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login feito com sucesso.');

  // Acessar Databases > Clientes
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.click('text=Databases');
  await page.click('text=Clientes');

  // Abrir formulário
  await page.waitForSelector('button:has-text("Criar registro")');
  await page.click('button:has-text("Criar registro")');
  await page.waitForTimeout(1000);

  // Dados da procuração
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
    const label = await page.locator(`text=${campo}`).first();
    const input = await label.evaluateHandle(el => {
      const parent = el.closest('div');
      return parent ? parent.querySelector('input, textarea') : null;
    });
    if (input) {
      await input.fill(valor);
    } else if (campo === 'Estado Civil') {
      await label.click();
      await page.click(`text=${valor}`);
    }
  }

  // Anexar arquivos
  const arquivos = {
    cnh: path.resolve(__dirname, 'CNH-e.pdf.pdf'),
    procuracoes: [
      path.resolve(__dirname, 'PROCURAÇÃO.pdf'),
      path.resolve(__dirname, 'PROCURAÇÃO.pdf')
    ]
  };

  const fileInputs = await page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(arquivos.cnh);
  await fileInputs.nth(1).setInputFiles(arquivos.procuracoes);

  // Clicar no botão final
  await page.click('button:has-text("Criar registro")');
  console.log('✅ Registro criado com sucesso.');

  // Tirar print
  await page.waitForTimeout(3000);
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
