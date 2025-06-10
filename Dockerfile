# Usa a imagem oficial do Playwright na versão 1.52.0 (compatível com seu package.json)
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (melhora cache de build)
COPY package*.json ./

# Instala as dependências do Node.js
RUN npm install

# Agora copia todos os arquivos do projeto
COPY . .

# Instala os navegadores do Playwright e dependências extras do sistema
RUN npx playwright install --with-deps

# Define a variável de ambiente (opcional, útil em produção)
ENV NODE_ENV=production

# Expõe a porta do Express (servidor local)
EXPOSE 8080

# Comando padrão para iniciar o servidor
CMD ["node", "index.js"]
