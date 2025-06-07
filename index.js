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

  // Navegar até a Database "Clientes"
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.click('text=Databases');
  await page.waitForSelector('text=Clientes');
  await page.click('text=Clientes');

  // Clicar em "Criar registro"
  await page.waitForSelector('button:has-text("Criar registro")');
  await page.click('button:has-text("Criar registro")');

  // Dados extraídos da procuração
  const nome = "ADRIANO ANTONIO DE SOUZA";
  const cpf = "039.174.906-60";
  const estadoCivil = "Casado(a)";
  const profissao = "Vigilante";
  const email = "jonas1gui@gmail.com";
  const telefone = "31988429016";
  const endereco = "Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG";

  // Preencher campos de texto
  const inputs = await page.$$('input[placeholder="Digite aqui ..."]');
  await inputs[0].fill(nome);
  await inputs[1].fill(cpf);

  // Estado Civil
  await page.click('label:has-text("Estado Civil")');
  await page.click(`text=${estadoCivil}`);

  await inputs[2].fill(profissao);
  await inputs[3].fill(email);
  await inputs[4].fill(telefone);
  await inputs[5].fill(endereco);

  // Upload dos arquivos (CNH e 2x procuração)
  const arquivos = await page.$$('input[type="file"]');
  await arquivos[0].setInputFiles(path.join(__dirname, 'CNH-e.pdf.pdf'));
  await arquivos[1].setInputFiles([
    path.join(__dirname, 'PROCURAÇÃO.pdf'),
    path.join(__dirname, 'PROCURAÇÃO.pdf')
  ]);

  // Clicar em "Criar registro"
  await page.click('button:has-text("Criar registro")');
  console.log('✅ Registro criado com sucesso.');

  // Print final
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'registro_final.png' });

  await browser.close();
})();

// Rota para baixar print
app.get('/', (req, res) => {
  res.send(`<h2>✅ Robô executado com sucesso</h2><p><a href="/print">📥 Baixar print</a></p>`);
});

app.get('/print', (req, res) => {
  res.download('registro_final.png');
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
