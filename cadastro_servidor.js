const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 <b>Robô Pipefy</b></h2>
    <p><a href="/start-clientes">Iniciar cadastro de cliente</a></p>
    <p><a href="/start-crlv">Iniciar cadastro de CRLV</a></p>
     <p><a href="/start-rgp">Iniciar cadastro de serviço RGP</a></p>
    <p><a href="/print-crlv" target="_blank">📸 Ver último print do CRLV</a></p>
  `);
});

// 📋 ROTA CLIENTES
app.get('/start-clientes', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CLIENTES...\n');

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
      'Profissão': 'Vigilante',
      'Email': 'jonas1gui@gmail.com',
      'Número de telefone': '31988429016',
      'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
    };

    for (const [campo, valor] of Object.entries(dados)) {
  try {
    if (campo === 'Placa') {
      await page.locator('input[placeholder="Digite aqui ..."]').first().fill(valor);
      log(`✅ ${campo} (campo especial preenchido)`);
    } else {
      const label = await page.getByLabel(campo);
      await label.scrollIntoViewIfNeeded();
      await label.fill(valor);
      log(`✅ ${campo}`);
    }
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

// 🚗 ROTA CRLV
app.get('/start-crlv', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>🧠 Iniciando robô de CRLV...\n');

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

    log('📁 Acessando banco CRLV...');
    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('CRLV', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');

    const dados = {
      'Placa': 'GKD0F82',
      'CHASSI': '9C2KF4300NR006285',
      'RENAVAM': '01292345630',
      'Estado de emplacamento': 'SP'
    };

    for (const [campo, valor] of Object.entries(dados)) {
  try {
    if (campo === 'Placa') {
      await page.locator('input[placeholder="Digite aqui ..."]').first().fill(valor);
      log(`✅ ${campo} (campo especial preenchido)`);
    } else {
      const label = await page.getByLabel(campo);
      await label.scrollIntoViewIfNeeded();
      await label.fill(valor);
      log(`✅ ${campo}`);
    }
  } catch {
    log(`❌ ${campo}`);
  }
}

    const urlArquivo = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    const localPath = path.resolve(__dirname, 'crlv_temp.pdf');
    await baixarArquivo(urlArquivo, localPath);
    const nomeArquivo = path.basename(localPath);
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(0);
    await botao.scrollIntoViewIfNeeded();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.click()
    ]);
    await fileChooser.setFiles(localPath);
    await page.waitForTimeout(3000);

    const sucesso = await page.locator(`text="${nomeArquivo}"`).first().isVisible({ timeout: 7000 });
    if (sucesso) {
      log('✅ Arquivo CRLV enviado');
    } else {
      log('❌ Falha no upload do CRLV');
    }

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        log('✅ Registro CRLV criado');
        break;
      }
    }

    const screenshotPath = path.resolve(__dirname, 'registro_crlv.png');
    await page.screenshot({ path: screenshotPath });
    log('📸 Capturado print da tela final');
    await browser.close();

    res.write('</pre><h3>🖼️ Print final da tela:</h3>');
    const base64img = fs.readFileSync(screenshotPath).toString('base64');
    res.write(`<img src="data:image/png;base64,${base64img}" style="max-width:100%; border:1px solid #ccc;">`);
    res.end();

  } catch (err) {
    log(`❌ Erro: ${err.message}`);
    res.end('</pre><p style="color:red">Erro crítico. Verifique os logs.</p>');
  } finally {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
  }
});

// 🔎 VISUALIZAR PRINT
app.get('/print-crlv', (req, res) => {
  const screenshotPath = path.resolve(__dirname, 'registro_crlv.png');
  if (fs.existsSync(screenshotPath)) {
    const base64 = fs.readFileSync(screenshotPath).toString('base64');
    res.send(`
      <h3>📷 Último print da tela do CRLV:</h3>
      <img src="data:image/png;base64,${base64}" style="max-width:100%; border:1px solid #ccc;">
      <p><a href="/">⬅️ Voltar</a></p>
    `);
  } else {
    res.send('<p>❌ Nenhum print encontrado ainda.</p><p><a href="/">⬅️ Voltar</a></p>');
  }
});

// 🧠 Função de download
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
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});

// ➕ ROTA PARA CADASTRO RGP (somente entrar e tirar print)
app.get('/start-rgp', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô RGP...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

  let browser;
  const beforeClickPath = path.resolve(__dirname, 'print_antes_click.png');
  const afterClickPath = path.resolve(__dirname, 'print_depois_click.png');
  const printCliente = path.resolve(__dirname, 'print_cliente_rgp.png');
  const printAntesCRLV = path.resolve(__dirname, 'print_antes_clique_crlv.png');
  const printCRLV = path.resolve(__dirname, 'print_crlv_rgp.png');

  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
  } catch {
    log('⛔ Robô já está em execução.');
    return res.end('</pre>');
  }

  setTimeout(async () => {
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      log('🔐 Realizando login...');
      await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
      await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
      await page.click('#kc-login');
      await page.fill('input[name="password"]', 'Mg.12345@');
      await page.click('#kc-login');
      await page.waitForNavigation({ waitUntil: 'load' });

      log('📂 Acessando Pipe RGP...');
      await page.getByText('RGP', { exact: true }).click();
      await page.waitForTimeout(3000);

      const botaoEntrarPipe = page.locator('text=Entrar no pipe');
      if (await botaoEntrarPipe.count() > 0) {
        log('📌 Modal detectado. Clicando em "Entrar no pipe"...');
        await botaoEntrarPipe.first().click();
        await page.waitForTimeout(3000);
      } else {
        log('✅ Modal não encontrado. Prosseguindo...');
      }

      log('🔶 Procurando <span> com texto "Create new card"...');
      const span = await page.locator('span:text("Create new card")').first();
      if (await span.count() === 0) {
        log('❌ Elemento <span> "Create new card" não encontrado.');
        return res.end('</pre><p style="color:red">Erro: span não encontrado.</p>');
      }
      await span.scrollIntoViewIfNeeded();
      await page.screenshot({ path: beforeClickPath });
      log('📸 Print antes do clique salvo.');

      log('🧠 Tentando clique forçado via JavaScript...');
      await span.evaluate(el => el.click());
      await page.waitForTimeout(3000);
      await page.screenshot({ path: afterClickPath });
      log('📸 Print depois do clique salvo.');

      log('👤 Selecionando cliente pelo CPF...');
      const botaoCliente = await page.locator('div:has-text("Cliente") >> text=Criar registro').first();
      await botaoCliente.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('✅ Cliente selecionado com sucesso');
      await page.getByText('*Cliente', { exact: true }).click();
      await page.waitForTimeout(1000);
      log('🪝 Menu flutuante fechado clicando no título "*Cliente".');
      await page.screenshot({ path: printCliente });
      log('📸 Print após seleção do cliente salvo como print_cliente_rgp.png');

      log('🚗 Selecionando veículo pelo CRLV...');
      const botaoCRLV = await page.locator('div:has-text("Veículo (CRLV)") >> text=Criar registro').first();
      await botaoCRLV.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: printAntesCRLV });
      log('📸 Print antes de tentar clicar no CRLV salvo como print_antes_clique_crlv.png');

      const itemCRLV = await page.locator('text=OPB3D62').first();
      try {
        await itemCRLV.scrollIntoViewIfNeeded();
        await itemCRLV.click();
        log('✅ Veículo selecionado com sucesso');
      } catch {
        log('⚠️ Clique direto falhou. Tentando clique via JavaScript...');
        await itemCRLV.evaluate(el => el.click());
        log('✅ Veículo selecionado com sucesso via JavaScript');
      }
      await page.screenshot({ path: printCRLV });
      log('📸 Print após seleção do veículo salvo como print_crlv_rgp.png');
    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
    } finally {
      try { if (browser) await browser.close(); } catch {}
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);

      res.write('</pre><h3>📸 Prints:</h3>');
      if (fs.existsSync(beforeClickPath)) {
        const base64Before = fs.readFileSync(beforeClickPath).toString('base64');
        res.write(`<p><b>Antes do clique:</b><br><img src="data:image/png;base64,${base64Before}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      if (fs.existsSync(afterClickPath)) {
        const base64After = fs.readFileSync(afterClickPath).toString('base64');
        res.write(`<p><b>Depois do clique:</b><br><img src="data:image/png;base64,${base64After}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      if (fs.existsSync(printCliente)) {
        const base64Cliente = fs.readFileSync(printCliente).toString('base64');
        res.write(`<p><b>Após selecionar cliente:</b><br><img src="data:image/png;base64,${base64Cliente}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      if (fs.existsSync(printAntesCRLV)) {
        const base64AntesCRLV = fs.readFileSync(printAntesCRLV).toString('base64');
        res.write(`<p><b>Antes de clicar no CRLV:</b><br><img src="data:image/png;base64,${base64AntesCRLV}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      if (fs.existsSync(printCRLV)) {
        const base64CRLV = fs.readFileSync(printCRLV).toString('base64');
        res.write(`<p><b>Após selecionar CRLV:</b><br><img src="data:image/png;base64,${base64CRLV}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      res.end('<p style="color:red"><b>⚠️ Finalizado. Verifique os prints para diagnosticar erros, se houver.</b></p>');
    }
  }, 60000); // ⏱️ Espera inicial de 1 minuto
});
