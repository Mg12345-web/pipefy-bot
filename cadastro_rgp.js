app.get('/start-rgp', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<pre>⏳ Aguardando 1 minuto para iniciar o robô RGP...\n');

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
      const browser = await chromium.launch({ headless: true });
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

      // 🖼️ Capturando print do Pipe RGP logo após abrir
const screenshotPipePath = path.resolve(__dirname, 'print_pipe_rgp.png');
await page.screenshot({ path: screenshotPipePath });
log('📸 Print do Pipe RGP salvo como print_pipe_rgp.png');

      log('🔘 Procurando <span> com texto "Create new card"...');
      const span = await page.locator('span:text("Create new card")').first();
      await span.scrollIntoViewIfNeeded();

      const pai = await span.evaluateHandle(node => node.closest('button, div'));
      if (!pai) {
        log('❌ Elemento pai clicável não encontrado.');
        return res.end('</pre><p style="color:red">Erro: pai do botão não encontrado.</p>');
      }

     await pai.scrollIntoViewIfNeeded();
await pai.click();
log('✅ Clique no botão pai do "Create new card" realizado com sucesso!');

// Mostrar print no navegador
const base64img = fs.readFileSync(screenshotPipePath).toString('base64');
res.write('</pre><h3>🖼️ Print da tela após abrir o Pipe:</h3>');
res.write(`<img src="data:image/png;base64,${base64img}" style="max-width:100%; border:1px solid #ccc;">`);

await browser.close();
res.end('<p style="color:green">✅ Robô finalizado com sucesso. Botão clicado.</p>');


    } catch (err) {
      log(`❌ Erro crítico: ${err.message}`);
      res.end('</pre><p style="color:red">Erro crítico. Verifique os logs.</p>');
    } finally {
      if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
    }
  }, 60000);
});
