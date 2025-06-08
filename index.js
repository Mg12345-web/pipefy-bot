// Novo index.js com logs em tempo real no Railway e sem res.send
const { chromium } = require('playwright');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 8080;

let rodando = false;

app.get('/', async (req, res) => {
  if (rodando) return res.end('⚠️ Robô já está em execução.');
  rodando = true;

  const statusCampos = [];
  const log = (msg) => {
    statusCampos.push(msg);
    process.stdout.write(msg + '\n');
  };

  try {
    log('🔄 Iniciando navegador...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    log('🌐 Acessando login do Pipefy...');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?...');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    log('📁 Acessando database Clientes...');
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
        await label.scrollIntoViewIfNeeded();
        await label.fill(valor);
        log(`✅ ${campo}`);
      } catch {
        log(`❌ ${campo}`);
      }
    }

    log('🔽 Selecionando Estado Civil...');
    try {
      const select = await page.getByRole('combobox');
      await select.scrollIntoViewIfNeeded();
      await select.click();
      const opcao = await page.getByText(/solteir/i);
      await opcao.click();
      log('✅ Estado civil selecionado');
    } catch {
      log('❌ Estado civil não encontrado');
    }

    log('🖼️ Enviando arquivos de teste...');
    const arquivos = [
      { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', local: 'cnh_teste.pdf', label: '* CNH' },
      { url: 'https://www.africau.edu/images/default/sample.pdf', local: 'proc_teste.pdf', label: '* Procuração' }
    ];

    for (let i = 0; i < arquivos.length; i++) {
      const file = path.resolve(__dirname, arquivos[i].local);
      await baixarArquivo(arquivos[i].url, file);
      if (fs.existsSync(file)) {
        await enviarArquivoPorOrdem(page, i, arquivos[i].label, file, log);
      } else {
        log(`❌ Arquivo ${arquivos[i].label} não encontrado`);
      }
    }

    log('🖱️ Clicando em "Criar registro"...');
    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        log('✅ Registro criado com sucesso');
        break;
      }
    }

    await page.waitForTimeout(5000);
    await browser.close();
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
    log('✅ Robô finalizado.');
  } catch (err) {
    log('❌ Erro: ' + err.message);
  }

  rodando = false;
  res.end('✅ Execução finalizada. Veja o console/log para detalhes.');
});

function baixarArquivo(url, destino) {
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

async function enviarArquivoPorOrdem(page, index, labelTexto, arquivoLocal, log) {
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
      await page.waitForTimeout(2000);
      log(`✅ ${labelTexto} enviado`);
    } else {
      log(`❌ ${labelTexto} falhou`);
    }
  } catch {
    log(`❌ Erro ao enviar ${labelTexto}`);
  }
}

app.listen(PORT, () => {
  process.stdout.write(`🖥️ Servidor escutando em http://localhost:${PORT}\n`);
});
