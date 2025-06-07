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

  const statusCampos = [];

  for (const [campo, valor] of Object.entries(dados)) {
    try {
      const label = await page.getByLabel(campo);
      await label.scrollIntoViewIfNeeded();
      await label.fill(valor);
      console.log(`✅ ${campo} preenchido`);
      statusCampos.push(`✅ ${campo}`);
    } catch (error) {
      console.log(`❌ Erro ao preencher o campo: ${campo}`);
      statusCampos.push(`❌ ${campo}`);
    }
  }

  const arquivos = fs.readdirSync(__dirname);
  const arquivoCNH = arquivos.find(nome => nome.toLowerCase().includes('cnh'));
  const arquivosProc = arquivos.filter(nome =>
    nome.toLowerCase().includes('procuracao') || nome.toLowerCase().includes('procuração')
  );

  const inputFiles = await page.$$('input[type="file"]');

  if (arquivoCNH && inputFiles[0]) {
    await inputFiles[0].scrollIntoViewIfNeeded();
    await inputFiles[0].setInputFiles(path.resolve(__dirname, arquivoCNH));
    console.log('📎 CNH enviada');
    statusCampos.push('📎 CNH enviada');
    await page.waitForTimeout(15000);
  } else {
    statusCampos.push('❌ CNH não encontrada');
  }

  if (arquivosProc.length > 0 && inputFiles[1]) {
    await inputFiles[1].scrollIntoViewIfNeeded();
    await inputFiles[1].setInputFiles(arquivosProc.map(nome => path.resolve(__dirname, nome)));
    console.log('📎 Procuração enviada');
    statusCampos.push('📎 Procuração enviada');
    await page.waitForTimeout(15000);
  } else {
    statusCampos.push('❌ Procuração não encontrada');
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
    statusCampos.push('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
  } else {
    console.log('✅ Registro realmente criado com sucesso.');
    statusCampos.push('✅ Registro criado com sucesso');
  }

  await page.screenshot({ path: 'registro_final.png' });
  fs.writeFileSync('status.txt', statusCampos.join('\n'));
  await browser.close();
})();

app.get('/', (req, res) => {
  const status = fs.existsSync('status.txt') ? fs.readFileSync('status.txt', 'utf8') : 'Sem status.';
  res.send(`<h2>✅ Robô executado</h2><pre>${status}</pre><p><a href="/print">📥 Baixar print final</a><br><a href="/antes">📥 Ver print antes do clique</a></p>`);
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
