// cadastro_clientes.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8081;
const LOCK_PATH = path.join(os.tmpdir(), 'robo_clientes.lock');

app.get('/start-clientes', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CLIENTES...
');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
  } catch (e) {
    log('⛔ Robô já em execução.');
    return res.end('</pre>');
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    log('🔐 Acessando login...');
    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    log('📁 Acessando banco Clientes...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
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
        log(`✅ ${campo}`);
      } catch {
        log(`❌ ${campo}`);
      }
    }

    const arquivos = [
      { url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', nome: 'cnh_teste.pdf' },
      { url: 'https://www.africau.edu/images/default/sample.pdf', nome: 'proc_teste.pdf' }
    ];

    for (let i = 0; i < arquivos.length; i++) {
      const destino = path.resolve(__dirname, arquivos[i].nome);
      await baixarArquivo(arquivos[i].url, destino);
      const nomeArquivo = path.basename(destino);
      const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
      const botao = botoesUpload.nth(i);

      await botao.scrollIntoViewIfNeeded();
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botao.click()
      ]);
      await fileChooser.setFiles(destino);
      await page.waitForTimeout(3000);

      const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
      if (sucesso) {
        log(`✅ Arquivo ${i + 1} enviado`);
      } else {
        log(`❌ Falha no upload do arquivo ${i + 1}`);
      }
    }

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        log('✅ Registro de cliente criado');
        break;
      }
    }

    await browser.close();
    res.end('</pre><h3>✅ Cadastro de cliente concluído!</h3>');

  } catch (err) {
    log(`❌ Erro: ${err.message}`);
    res.end('</pre><p style="color:red">Erro crítico. Verifique os logs.</p>');
  } finally {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  }
});

// 🔒 Libera o lock ao sair do processo
process.on('exit', () => {
  try { fs.unlinkSync(LOCK_PATH); } catch {}
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

app.listen(PORT, () => {
  console.log(`🖥️ Robô CLIENTES escutando em http://localhost:${PORT}`);
});
