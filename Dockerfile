# Usa imagem oficial do Playwright na versão 1.52.0 (compatível com a lib instalada)
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Cria diretório de trabalho
WORKDIR /app

# Copia os arquivos da aplicação para dentro do container
COPY . .

# Instala as dependências do Node.js
RUN npm install

# Expõe porta para servidor Express (caso esteja usando)
EXPOSE 8080

# Comando padrão ao iniciar o container (pode ser alterado no Railway se necessário)
CMD ["node", "cadastro_servidor.js"]
