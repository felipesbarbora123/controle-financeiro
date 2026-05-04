# Dockerfile para o frontend React

# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# CRA embute REACT_APP_* no JS na hora do build; variável só no container em runtime não altera o bundle.
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build da aplicação
RUN npm run build

# Stage 2: Servir arquivos estáticos
FROM nginx:alpine

# Copiar arquivos buildados do stage anterior
COPY --from=build /app/build /usr/share/nginx/html

# Copiar configuração customizada do nginx (opcional, para SPA)
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Comando para iniciar nginx
CMD ["nginx", "-g", "daemon off;"]
