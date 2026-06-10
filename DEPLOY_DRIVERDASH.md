# DriverDash Roxou - Ubuntu VPS Deployment Manual 🚀

Este manual descreve o procedimento completo para realizar o deploy em ambiente de produção do **DriverDash Roxou** no servidor VPS Linux Ubuntu, utilizando **PM2** para gerenciamento de processos, **Nginx** como Proxy Reverso e **Let's Encrypt** para criptografia SSL.

---

## 1. Topologia do Ambiente de Produção

- **Domínio**: `driverdash.roxou.com.br`
- **Porta Interna da Aplicação**: `3000`
- **Servidor Web**: Nginx (Proxy Reverso para a porta 3000 com HTTP/2 e compactação Gzip ativa)
- **Gerenciador de Processos**: PM2 (`driverdash-web`)
- **Certificado Digital**: Let's Encrypt (SSL/TLS v1.2 & v1.3 com renovação automática de 90 dias)

---

## 2. Preparação da VPS Linux (Ubuntu 22.04 LTS ou superior)

Conecte-se à sua VPS via SSH e execute as atualizações e instalações dos pacotes de infraestrutura básicos:

```bash
# Atualizar listas de repositórios e pacotes existentes
sudo apt update && sudo apt upgrade -y

# Instalar utilitários essenciais
sudo apt install -y curl git ufw build-essential logrotate
```

### Instalação do NodeJS LTS (v18+)
```bash
# Adicionar repositório oficial do NodeSource para Node v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Validar versões instaladas
node -v
npm -v
```

### Instalação e Ativação do PM2 (Gerenciador de Processos)
```bash
sudo npm install -y -g pm2
```

---

## 3. Implantação e Transição de Código

Na VPS, clone o repositório ou transfira o pacote compactado da aplicação para a pasta de destino `/var/www/driverdash`:

```bash
# Criar diretório da aplicação e definir dono do arquivo para o usuário atual (ex: ubuntu)
sudo mkdir -p /var/www/driverdash
sudo chown -R $USER:$USER /var/www/driverdash

# Ir para a pasta
cd /var/www/driverdash
```

### Configuração de Variáveis de Ambiente
Crie o arquivo `.env` definitivo e preencha as credenciais correspondentes do Supabase de Produção:

```bash
cp .env.example .env
nano .env
```

Garanta que os valores em produção contenham a chave e URL do Supabase correto:
```env
VITE_SUPABASE_URL="https://seu-slug-supabase.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-chave-anonima-supabase"
NODE_ENV="production"
PORT="3000"
```

### Instalação de Dependências e Build de Produção
```bash
# Instalar pacotes de maneira limpa omitindo os pacotes extras de dev desnecessários para execução
npm ci

# Executar build otimizado (unirá o Frontend em dist/ e compilará o Express Server com esbuild em dist/server.cjs)
npm run build
```

---

## 4. Inicialização sob Gerenciamento do PM2

Com o build finalizado (verifique a presença do arquivo `dist/server.cjs`), execute a inicialização do gerenciador de processos utilizando o arquivo de ecossistema fornecido na raiz:

```bash
# Iniciar o processo "driverdash-web" configurado no ecossistema
pm2 start ecosystem.config.js

# Salvar o estado para sobrevivência em caso de reinicialização do sistema
pm2 save

# Gerar script de startup automático do PM2 no boot da VPS
pm2 startup
```
*(Copie o comando exibido pela saída do `pm2 startup` e execute com privilégios de `sudo` para consolidar o boot).*

---

## 5. Configuração do Nginx (Servidor Reverso & Otimização)

Mova a configuração de rede do Nginx do projeto para o diretório de sites do sistema:

```bash
# Copiar arquivo de configuração do projeto para o Nginx
sudo cp nginx-driverdash.conf /etc/nginx/sites-available/driverdash.roxou.conf

# Criar link simbólico para ativação
sudo ln -s /etc/nginx/sites-available/driverdash.roxou.conf /etc/nginx/sites-enabled/

# Testar integridade da sintaxe do Nginx
sudo nginx -t

# Reiniciar o servidor Nginx para aplicar as alterações
sudo systemctl restart nginx
```

---

## 6. Geração e Ativação de SSL com Let's Encrypt

Utilize o Certbot para obter certificados SSL seguros e gratuitos:

```bash
# Instalar Certbot e o plugin do Nginx
sudo apt install -y certbot python3-certbot-nginx

# Obter o certificado e configurar redirecionamento automático do Nginx
sudo certbot --nginx -d driverdash.roxou.com.br

# Validar teste de renovação automática silenciosa do certificado (Cron automático)
sudo certbot renew --dry-run
```

---

## 7. Configuração do Firewall Governamental (UFW)

Proteja portas de acesso sensíveis e mantenha expostas apenas as portas de navegação HTTP, HTTPS e SSH:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir acessos
sudo ufw allow ssh             # Porta 22
sudo ufw allow 'Nginx Full'    # Portas 80 e 443

# Ativar Firewall
sudo ufw enable
```

---

## 8. Logs do Sistema, Rotação e Monitoramento

1. Para monitorar as rotas de GPS e sincronizações de logs analíticos do sistema em tempo real:
   ```bash
   pm2 logs driverdash-web
   ```

2. Para ver a saúde consolidada do sistema do ponto de vista operacional público:
   Acesse a rota de diagnóstico de resiliência:
   `https://driverdash.roxou.com.br/status`

3. O sistema gerará logs em `/home/ubuntu/.pm2/logs/driverdash-web-out.log` e `/home/ubuntu/.pm2/logs/driverdash-web-error.log`. O script `logrotate` incluído garante a rotação desses arquivos para não consumir todo o armazenamento físico da VPS em corridas longas.
