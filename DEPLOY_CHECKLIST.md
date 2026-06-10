# DriverDash Roxou - Production VPS Deployment Checklist 🚀

Guia oficial para empacotamento, instalação e deploy em produção na VPS Roxou, garantindo alta disponibilidade, segurança e monitoramento contínuo.

---

## 1. Requisitos de Ambiente (VPS)
- [ ] **SO**: Ubuntu 22.04 LTS ou superior.
- [ ] **NodeJS**: v18.18.0 LTS ou superior.
- [ ] **Nginx**: Servidor web principal atuando como Proxy Reverso.
- [ ] **PM2**: Gerenciador de processos Node.js para manter a aplicação online.
- [ ] **Supabase**: Credenciais de acesso de Produção (URL e KEY seguras).

---

## 2. Preparação & Empacotamento
Execute localmente ou em sua esteira CI para validar os arquivos críticos:
```bash
# Instalar dependências completas
npm install

# Validar compilação limpa do frontend e do servidor
npm run build
```
O build deve gerar:
- Pasta `dist/` contendo os ativos estáticos otimizados.
- Arquivo `dist/server.cjs` contendo o bundle backend autônomo do servidor Express.

---

## 3. Configuração do Nginx (Proxy Reverso)
O DriverDash Roxou escuta exclusivamente na porta **3000**. Configure o Nginx para redirecionar o tráfego externo SSL com segurança:

1. Crie o arquivo `/etc/nginx/sites-available/driverdash.roxou` com o seguinte template:
```nginx
server {
    listen 80;
    server_name driverdash.roxou.com.br; # Ajuste para o domínio real

    # Redirecionamento permanente para HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name driverdash.roxou.com.br;

    # Certificados SSL (Recomendado Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/driverdash.roxou.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/driverdash.roxou.com.br/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Suporte para WebSockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers de encaminhamento clínico
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        client_max_body_size 12M;
    }
}
```
2. Ative as configurações do site e valide o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/driverdash.roxou /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Gerenciamento do Servidor com PM2
Para garantir auto-reinicialização em caso de falhas e pós-boottime da VPS:

Crie o arquivo `ecosystem.config.js` na raiz do deploy:
```javascript
module.exports = {
  apps: [{
    name: 'driverdash-roxou',
    script: 'dist/server.cjs',
    instances: 1, // Utilize 'max' para múltiplos cores se necessário
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Inicie o processo:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 5. Rotação de Logs (Logrotate)
Para evitar que registros da aplicação fiquem gigantescos e consumam todo o disco da VPS, crie uma regra do `logrotate`:

1. Abra novo aquivo `/etc/logrotate.d/driverdash`:
```bash
sudo nano /etc/logrotate.d/driverdash
```
2. Cole o conteúdo:
```text
/home/ubuntu/.pm2/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0660 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 6. Backups Periódicos do Banco de Dados
Mesmo usando Supabase gerenciado, é recomendável manter uma exportação cronológica regular estrutural e de dados (especialmente logs e faturamentos):

1. Script simples de backup de tabelas (`backup_supabase.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/backups/supabase"
DATE=$(date +%Y-%m-%d_%H%M%S)
export PGPASSWORD="SUA_SENHA_POSTGRES_SUPABASE"

mkdir -p "$BACKUP_DIR"

# Dump seletivo estrutural e de dados das tabelas críticas
pg_dump -h db.xxxxxxxxxxxx.supabase.co -U postgres -d postgres -t profiles -t earnings -t expenses -t app_logs -t audit_logs > "$BACKUP_DIR/backup_driverdash_$DATE.sql"

# Compactar backup
gzip "$BACKUP_DIR/backup_driverdash_$DATE.sql"

# Limpar backups com mais de 30 dias
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
```
2. Adicione ao cron do sistema para rodar de madrugada:
```bash
# Executa todo dia às 03:00 AM
0 3 * * * /bin/bash /backups/backup_supabase.sh
```

---

## 7. Verificação Pós-Deploy 🌟
Após ativação, teste os seguintes canais públicos e restritos:
- [ ] Tráfego público direto respondendo em `https://driverdash.roxou.com.br/status`
- [ ] Acesso às rotas restritas seguras com contas autorizadas.
- [ ] Fluxo de logs de auditoria carregando sob a aba de **Observabilidade** no painel de administração.
