# Deploy (VPS + Docker Compose)

## 1) Server requirements
- Ubuntu 22.04+
- 4 vCPU / 8 GB RAM recommended
- Docker + Docker Compose plugin installed

## 2) Clone project
```bash
git clone https://github.com/NotAfanasev/semantic-search-ui.git
cd semantic-search-ui
```

## 3) Build and run
```bash
docker compose up -d --build
```

After startup:
- App: `http://SERVER_IP`
- Next.js container: `web`
- Python API container: `api`

## 4) Check logs
```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f nginx
```

## 5) Update after new commits
```bash
git pull
docker compose up -d --build
```

## Notes
- Knowledge base files are persisted from `./pyyy/data` on host.
- HuggingFace model cache is persisted in Docker volume `hf_cache`.
- For HTTPS, put Caddy or Nginx + Certbot in front, or extend current `nginx` config.
