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

  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('Clientes', { exact: true }).click();

  await page.waitForSelector('button:has-text("Criar registro")', { timeout: 15000 });
  await page.click('button:has-text("Criar registro")');

  const dados = {
    'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
    'CPF OU CNPJ': '414.746.148-41',
    'Profissão': 'Vigilante',
    'Email': 'jonas1gui@gmail.com',
    'Número de telefone': '31988429016',
    'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
  };

  for (const [campo, valor] of Object.entries(dados)) {
    await page.getByLabel(campo).fill(valor);
  }

  const arquivos = fs.readdirSync(__dirname);
  const arquivoCNH = arquivos.find(nome => nome.toLowerCase().includes('cnh'));
  const arquivosProc = arquivos.filter(nome =>
    nome.toLowerCase().includes('procuracao') || nome.toLowerCase().includes('procuração')
  );

  // Rolagem automática para localizar campos de upload
  const scrollAndFindInput = async (keyword) => {
    let scrollY = 0;
    let inputFound = null;
    for (let i = 0; i < 10; i++) {
      const inputs = await page.$$('input[type="file"]');
      for (const input of inputs) {
        const label = await input.evaluate(el => el.closest('div')?.innerText || '');
        if (label.toLowerCase().includes(keyword)) {
          return input;
        }
      }
      scrollY += 500;
      await page.mouse.wheel(0, scrollY);
      await page.waitForTimeout(500);
    }
    return null;
  };

  const inputCNH = await scrollAndFindInput('cnh');
  if (arquivoCNH && inputCNH) {
    await inputCNH.setInputFiles(path.resolve(__dirname, arquivoCNH));
    console.log('📎 CNH enviada');
    await page.waitForTimeout(15000);
  }

  const inputProc = await scrollAndFindInput('procuracao');
  if (arquivosProc.length > 0 && inputProc) {
    await inputProc.setInputFiles(arquivosProc.map(nome => path.resolve(__dirname, nome)));
    console.log('📎 Procuração enviada');
    await page.waitForTimeout(15000);
  }

  await page.screenshot({ path: 'erro_antes_do_click.png' });

  try {
    await page.locator('button[data-testid="create-record-fab-button"]').click({ timeout: 5000 });
  } catch (e) {
    console.log('⚠️ Clique normal falhou. Tentando forçar com JavaScript...');
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-testid="create-record-fab-button"]');
      if (btn) btn.click();
    });
  }

  await page.waitForTimeout(5000);
  const formStillOpen = await page.$('input[placeholder="Nome Completo"]');
  if (formStillOpen) {
    console.log('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
  } else {
    console.log('✅ Registro realmente criado com sucesso.');
  }

  await page.screenshot({ path: 'registro_final.png' });
  await browser.close();
})();

app.get('/', (req, res) => {
  res.send(`<h2>✅ Robô executado</h2><p><a href="/print">📥 Baixar print final</a><br><a href="/antes">📥 Ver print antes do clique</a></p>`);
});

app.get('/print', (req, res) => {
  res.download('registro_final.png');
});

app.get('/antes', (req, res) => {
  res.download('erro_antes_do_click.png');
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
