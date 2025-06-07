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

  await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');

  await page.waitForSelector('input[name="password"]', { timeout: 60000 });
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');

  await page.waitForNavigation({ waitUntil: 'load' });
  console.log('✅ Login feito com sucesso.');

  // Rolar e acessar "Databases"
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForSelector('text=Databases');
  await page.click('text=Databases');

  // Acessar "Clientes"
  await page.waitForSelector('text=Clientes');
  await page.click('text=Clientes');

  // Aguardar botão "Criar registro"
  await page.waitForSelector('button:has-text("Criar registro")');
  await page.click('button:has-text("Criar registro")');

  // Preencher os campos com base na procuração
  await page.waitForSelector('input[placeholder="Digite aqui ..."]');

  const nome = "ADRIANO ANTONIO DE SOUZA";
  const cpf = "039.174.906-60";
  const estadoCivil = "Casado(a)";
  const profissao = "Vigilante";
  const email = "jonas1gui@gmail.com";
  const telefone = "31988429016";
  const endereco = "Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG";

  const inputFields = await page.$$('input[placeholder="Digite aqui ..."]');
  await inputFields[0].fill(nome);          // Nome Completo
  await inputFields[1].fill(cpf);           // CPF
  await page.locator('text=Estado Civil').click();
  await page.locator(`text=${estadoCivil}`).click();
  await inputFields[2].fill(profissao);     // Profissão
  await inputFields[3].fill(email);         // Email
  await inputFields[4].fill(telefone);      // Telefone
  await inputFields[5].fill(endereco);      // Endereço

  // Anexar CNH
  const cnhInput = await page.locator('input[type="file"]').nth(0);
  await cnhInput.setInputFiles(path.resolve(__dirname, 'CNH-e.pdf.pdf'));

  // Anexar Procuração (duas vezes)
  const procuraçãoInput = await page.locator('input[type="file"]').nth(1);
  await procuraçãoInput.setInputFiles([
    path.resolve(__dirname, 'PROCURAÇÃO.pdf'),
    path.resolve(__dirname, 'PROCURAÇÃO.pdf')
  ]);

  // Clicar em "Criar registro"
  await page.click('button:has-text("Criar registro")');
  console.log('✅ Registro criado com sucesso.');

  // Tirar print de confirmação
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
