const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cria a pasta de uploads se não existir
const pastaUploads = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(pastaUploads)) {
  fs.mkdirSync(pastaUploads, { recursive: true });
}

// Define nomes fixos para cada tipo de campo
const nomesFixos = {
  cnh: 'cnh',
  procuracao: 'procuracao',
  contrato: 'contrato',
  autuacoes: 'autuacao' // múltiplos arquivos
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pastaUploads);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = nomesFixos[file.fieldname] || 'arquivo';

    if (!req._fileCount) req._fileCount = {};
    req._fileCount[file.fieldname] = (req._fileCount[file.fieldname] || 0) + 1;

    const count = req._fileCount[file.fieldname];
    const nomeFinal = (count > 1) ? `${base}_${count}${ext}` : `${base}${ext}`;

    cb(null, nomeFinal);
  }
});

const upload = multer({ storage });

module.exports = upload;
