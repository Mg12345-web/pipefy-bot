const { chromium } = require('playwright');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 8080;

const urlCNH = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const urlPROC = 'https://www.africau.edu/images/default/sample.pdf';

const caminhoCNH = path.resolve(__dirname, 'cnh_teste.pdf');
const caminhoPROC = path.resolve(__dirname, 'proc_teste.pdf');

async function baixarArquivo(url, destino) {
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
      botao.evaluate(el => el.click())
    ]);

    await fileChooser.setFiles(arquivoLocal);
    await page.waitForTimeout(2000);

    const sucessoUpload = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });

    if (sucessoUpload) {
      await page.waitForTimeout(15000);
      statusCampos.push(`✅ ${labelTexto} enviado`);
    } else {
      statusCampos.push(`❌ ${labelTexto} falhou (não visível após envio)`);
    }
  } catch (err) {
    statusCampos.push(`❌ Falha ao enviar ${labelTexto}`);
  }
}

(async () => {
  console.log(`🖥️ Servidor disponível em http://localhost:${PORT}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');

  await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
  await page.click('#kc-login');
  await page.fill('input[name="password"]', 'Mg.12345@');
  await page.click('#kc-login');
  await page.waitForNavigation({ waitUntil: 'load' });

  const statusCampos = [];

  await page.getByText('Databases', { exact: true }).click();
  await page.getByText('Clientes', { exact: true }).click();
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
    try {
      const label = await page.getByLabel(campo);
      await label.fill(valor);
      statusCampos.push(`✅ ${campo}`);
    } catch {
      statusCampos.push(`❌ ${campo}`);
    }
  }

  await baixarArquivo(urlCNH, caminhoCNH);
  await baixarArquivo(urlPROC, caminhoPROC);

  if (fs.existsSync(caminhoCNH)) {
    await enviarArquivoPorOrdem(page, 0, '* CNH', caminhoCNH, statusCampos);
  }
  if (fs.existsSync(caminhoPROC)) {
    await enviarArquivoPorOrdem(page, 1, '* Procuração', caminhoPROC, statusCampos);
  }

  await page.screenshot({ path: 'print_antes_clique.png' });

  try {
    const botoes = await page.locator('button', { hasText: 'Criar registro' }).all();
    console.log(`🔍 ${botoes.length} botões encontrados com texto "Criar registro"`);

    if (botoes.length > 0) {
      await botoes[0].scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await botoes[0].screenshot({ path: 'print_botao_1.png' });
      await botoes[0].click();
      await page.waitForTimeout(3000);
      statusCampos.push('✅ Primeiro botão clicado com sucesso.');
    } else {
      statusCampos.push('❌ Nenhum botão encontrado.');
    }
  } catch (e) {
    statusCampos.push('❌ Erro ao clicar no botão.');
  }

  const formStillOpen = await page.$('input[placeholder="Nome Completo"]');
  if (formStillOpen) {
    statusCampos.push('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
  } else {
    statusCampos.push('✅ Registro criado com sucesso');
  }

  await page.screenshot({ path: 'registro_final.png' });
  fs.writeFileSync('status.txt', statusCampos.join('\n'));
  await browser.close();
})();

app.get('/', (req, res) => {
  const status = fs.existsSync('status.txt') ? fs.readFileSync('status.txt', 'utf8') : 'Sem status.';
  res.send(`
    <h2>✅ Robô executado</h2>
    <pre>${status}</pre>
    <p>
      <a href="/print">📥 Baixar print final</a><br>
      <a href="/antes">📷 Ver print antes do clique</a><br>
      <a href="/botao1">📷 Botão clicado</a>
    </p>
  `);
});

app.get('/print', (req, res) => res.download('registro_final.png'));
app.get('/antes', (req, res) => res.download('print_antes_clique.png'));
app.get('/botao1', (req, res) => res.download('print_botao_1.png'));

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
