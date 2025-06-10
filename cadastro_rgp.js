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

      try {
        const valorObservacao = req.query.observacao || 'nada de observações';
        const campoObs = await page.getByLabel('Observação');
        await campoObs.scrollIntoViewIfNeeded();
        await campoObs.fill(valorObservacao);
        log('✅ Observação preenchida');
      } catch (e) {
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

      await browser.close();
      fs.unlinkSync(LOCK_PATH);

      res.write('</pre><h3>📸 Print Final:</h3>');
      if (fs.existsSync(printFinalCRLV)) {
        const base64Final = fs.readFileSync(printFinalCRLV).toString('base64');
        res.write(`<p><img src="data:image/png;base64,${base64Final}" style="max-width:100%; border:1px solid #ccc;"></p>`);
      }
      res.end('<p style="color:green"><b>✅ Robô RGP finalizado com sucesso!</b></p>');

    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      if (browser) await browser.close();
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
      res.end('<p style="color:red"><b>❌ Erro ao executar robô RGP.</b></p>');
    }
  }, 60000); // fim do setTimeout
}); // fim da rota /start-rgp

