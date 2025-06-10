const fs = require('fs');
const https = require('https');

/**
 * Baixa um arquivo de uma URL HTTPS e salva no caminho de destino.
 * @param {string} url - URL do arquivo para download.
 * @param {string} destino - Caminho local completo onde o arquivo será salvo.
 * @returns {Promise<void>} - Promessa resolvida quando o download finalizar.
 */
function baixarArquivo(url, destino) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destino);

    https.get(url, response => {
      if (response.statusCode >= 400) {
        fs.unlink(destino, () => {
          reject(new Error(`❌ Falha ao baixar: Código ${response.statusCode}`));
        });
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          resolve();
        });
      });
    }).on('error', err => {
      fs.unlink(destino, () => reject(err));
    });
  });
}

module.exports = { baixarArquivo };
