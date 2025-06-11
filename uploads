const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pastaUploads = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(pastaUploads)) fs.mkdirSync(pastaUploads, { recursive: true });

const nomesFixos = {
  cnh: 'cnh',
  procuracao: 'procuracao',
  contrato: 'contrato',
  crlv: 'crlv',
  autuacoes: 'autuacao'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pastaUploads),
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
