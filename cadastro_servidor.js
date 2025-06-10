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
    <p><a href="/start-semrgp">Iniciar cadastro de serviço sem RGP</a></p>
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
      'Estado Civil Atual': 'Solteiro',
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
  const printFinalCRLV = path.resolve(__dirname, 'print_final_crlv.png');

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
        await botaoEntrarPipe.first().click();
        await page.waitForTimeout(3000);
      }

      const span = await page.locator('span:text("Create new card")').first();
      await span.scrollIntoViewIfNeeded();
      await span.evaluate(el => el.click());
      await page.waitForTimeout(3000);

      const botaoCliente = await page.locator('div:has-text("Cliente") >> text=Criar registro').first();
      await botaoCliente.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('👤 Cliente selecionado com sucesso');
      await page.getByText('*Cliente', { exact: true }).click();
      await page.waitForTimeout(10000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      const botaoCRLV = await page.locator('text=Criar registro').nth(1);
      await botaoCRLV.scrollIntoViewIfNeeded();
      await botaoCRLV.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.getByText('OPB3D62', { exact: false }).first().click();
      log('🚗 CRLV selecionado com sucesso');

      // 📝 Preenchendo campo "Observação"
try {
  const valorObservacao = req.query.observacao || 'nada de observações';
  const campoObs = await page.getByLabel('Observação');
  await campoObs.scrollIntoViewIfNeeded();
  await campoObs.fill(valorObservacao);
  log('✅ Observação preenchida');
} catch (e) {
  log('❌ Campo Observação não encontrado ou ignorado');
}

// 🧾 Preenchendo campos AIT e Órgão Autuador
try {
  const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
  await inputs.nth(0).scrollIntoViewIfNeeded();
  await inputs.nth(0).fill('AM09263379');
  log('✅ AIT preenchido');

  await inputs.nth(1).scrollIntoViewIfNeeded();
  await inputs.nth(1).fill('Prefeitura de BH');
  log('✅ Órgão Autuador preenchido');
} catch (e) {
  log('❌ Erro ao preencher AIT ou Órgão Autuador');
}

log('📆 Preenchendo campo "Prazo para Protocolo"...');

try {
  const segmentoDia = await page.locator('[data-testid="day-input"]').first();
  const segmentoMes = await page.locator('[data-testid="month-input"]').first();
  const segmentoAno = await page.locator('[data-testid="year-input"]').first();
  const segmentoHora = await page.locator('[data-testid="hour-input"]').first();
  const segmentoMinuto = await page.locator('[data-testid="minute-input"]').first();

  await segmentoDia.click();
  await page.keyboard.type('09', { delay: 100 });

  await segmentoMes.click();
  await page.keyboard.type('06', { delay: 100 });

  await segmentoAno.click();
  await page.keyboard.type('2025', { delay: 100 });

  await segmentoHora.click();
  await page.keyboard.type('08', { delay: 100 });

  await segmentoMinuto.click();
  await page.keyboard.type('00', { delay: 100 });

  log('✅ Prazo para Protocolo preenchido corretamente');
} catch (e) {
  log('❌ Erro ao preencher o campo Prazo para Protocolo');
}

      const urlPDF = 'https://www.africau.edu/images/default/sample.pdf';
      const nomePDF = 'anexo.pdf';
      const caminhoPDF = path.resolve(__dirname, nomePDF);
      await baixarArquivo(urlPDF, caminhoPDF);

      const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
      await botaoUpload.scrollIntoViewIfNeeded();
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botaoUpload.click()
      ]);
      await fileChooser.setFiles(caminhoPDF);
      await page.waitForTimeout(3000);

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      try {
  const botoes = await page.locator('button:has-text("Create new card")');
  const total = await botoes.count();
  for (let i = 0; i < total; i++) {
    const botao = botoes.nth(i);
    const box = await botao.boundingBox();
    if (box && box.width > 200 && box.height > 30) {
      await botao.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await botao.click();
      break;
    }
  }

  await page.screenshot({ path: printFinalCRLV });
  log('📸 Print final do CRLV salvo como print_final_crlv_semrgp.png');
} catch (e) {
  log('❌ Erro ao finalizar o card ou tirar print');
}
}); // <- aqui termina o app.get('/start-rgp')
  
     // ➕ ROTA PARA CADASTRO SEM RGP (cópia do RGP com nome ajustado)
app.get('/start-semrgp', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô SEM RGP...\n');

  function log(msg) {
    res.write(`${msg}\n`);
    console.log(msg);
  }

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

      log('📂 Acessando Pipe SEM RGP...');
      await page.getByText('sem RGP', { exact: true }).click();
      await page.waitForTimeout(3000);

      const botaoEntrarPipe = page.locator('text=Entrar no pipe');
      if (await botaoEntrarPipe.count() > 0) {
        await botaoEntrarPipe.first().click();
        await page.waitForTimeout(3000);
      }

      const span = await page.locator('span:text("Create new card")').first();
      await span.scrollIntoViewIfNeeded();
      await span.evaluate(el => el.click());
      await page.waitForTimeout(3000);

      const botaoCliente = await page.locator('div:has-text("Cliente") >> text=Criar registro').first();
      await botaoCliente.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('143.461.936-25');
      await page.waitForTimeout(1500);
      await page.getByText('143.461.936-25', { exact: false }).first().click();
      log('👤 Cliente selecionado com sucesso');
      await page.getByText('*Cliente', { exact: true }).click();
      await page.waitForTimeout(10000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      const botaoCRLV = await page.locator('text=Criar registro').nth(1);
      await botaoCRLV.scrollIntoViewIfNeeded();
      await botaoCRLV.click();
      await page.waitForTimeout(1000);
      await page.locator('input[placeholder*="cards pelo título"]').fill('OPB3D62');
      await page.waitForTimeout(1500);
      await page.getByText('OPB3D62', { exact: false }).first().click();
      log('🚗 CRLV selecionado com sucesso');

      try {
        const valorObservacao = req.query.observacao || 'nada de observações';
        const campoObs = await page.getByLabel('Observação');
        await campoObs.scrollIntoViewIfNeeded();
        await campoObs.fill(valorObservacao);
        log('✅ Observação preenchida');
      } catch {
        log('❌ Campo Observação não encontrado ou ignorado');
      }

      try {
        const inputs = await page.locator('input[placeholder="Digite aqui ..."]');
        await inputs.nth(0).scrollIntoViewIfNeeded();
        await inputs.nth(0).fill('AM09263379');
        log('✅ AIT preenchido');

        await inputs.nth(1).scrollIntoViewIfNeeded();
        await inputs.nth(1).fill('Prefeitura de BH');
        log('✅ Órgão Autuador preenchido');
      } catch {
        log('❌ Erro ao preencher AIT ou Órgão Autuador');
      }

      log('📆 Preenchendo campo "Prazo para Protocolo"...');
      try {
        const segmentoDia = await page.locator('[data-testid="day-input"]').first();
        const segmentoMes = await page.locator('[data-testid="month-input"]').first();
        const segmentoAno = await page.locator('[data-testid="year-input"]').first();
        const segmentoHora = await page.locator('[data-testid="hour-input"]').first();
        const segmentoMinuto = await page.locator('[data-testid="minute-input"]').first();

        await segmentoDia.click();
        await page.keyboard.type('09', { delay: 100 });
        await segmentoMes.click();
        await page.keyboard.type('06', { delay: 100 });
        await segmentoAno.click();
        await page.keyboard.type('2025', { delay: 100 });
        await segmentoHora.click();
        await page.keyboard.type('08', { delay: 100 });
        await segmentoMinuto.click();
        await page.keyboard.type('00', { delay: 100 });

        log('✅ Prazo para Protocolo preenchido corretamente');
      } catch {
        log('❌ Erro ao preencher o campo Prazo para Protocolo');
      }

      const urlPDF = 'https://www.africau.edu/images/default/sample.pdf';
      const nomePDF = 'anexo.pdf';
      const caminhoPDF = path.resolve(__dirname, nomePDF);
      await baixarArquivo(urlPDF, caminhoPDF);
      
      const botaoUpload = await page.locator('button[data-testid="attachments-dropzone-button"]').last();
      await botaoUpload.scrollIntoViewIfNeeded();
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        botaoUpload.click()
      ]);
      await fileChooser.setFiles(caminhoPDF);
      await page.waitForTimeout(3000);

      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(1000);

      const botoes = await page.locator('button:has-text("Create new card")');
      const total = await botoes.count();
            for (let i = 0; i < total; i++) {
        const botao = botoes.nth(i);
        const box = await botao.boundingBox();
        if (box && box.width > 200 && box.height > 30) {
          await botao.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await botao.click();
          break;
        }
      } // ✅ FECHA o try AQUI

      await page.screenshot({ path: printFinalCRLV });
      log('📸 Print final do CRLV salvo como print_final_crlv_semrgp.png');

      await browser.close();
      fs.unlinkSync(LOCK_PATH);

      res.write('</pre><h3>📸 Print Final:</h3>');
      if (fs.existsSync(printFinalCRLV)) {
        const base64Final = fs.readFileSync(printFinalCRLV).toString('base64');
        res.write(`<p><img src="data:image/png;base64,${base64Final}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      res.end('<p style="color:red"><b>⚠️ Finalizado.</b></p>');

    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      if (browser) await browser.close();
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
      res.end('<p style="color:red"><b>⚠️ Erro inesperado. Finalizado com falha.</b></p>');
    }

  }, 60000); // ✅ FECHA o setTimeout
}); // ✅ FECHA a rota app.get()
      
// 🔒 Liberar lock após execução (opcional)
process.on('exit', () => {
  try { fs.unlinkSync(LOCK_PATH); } catch {}
});

      await browser.close();
      fs.unlinkSync(LOCK_PATH);

      res.write('</pre><h3>📸 Print Final:</h3>');
      if (fs.existsSync(printFinalCRLV)) {
        const base64Final = fs.readFileSync(printFinalCRLV).toString('base64');
        res.write(`<p><img src="data:image/png;base64,${base64Final}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      res.end('<p style="color:red"><b>⚠️ Finalizado.</b></p>');

    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      if (browser) await browser.close();
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
      res.end('<p style="color:red"><b>⚠️ Finalizado com erro crítico.</b></p>');
    }
  }, 60000); // fim do setTimeout
}); // fim do app.get('/start-semrgp')
