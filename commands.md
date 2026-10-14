## Docker Compose

```bash
docker compose build --no-cache
docker compose up --detach
docker compose stop
docker compose down --rmi all --volumes
```

## Git

```bash
git remote -v
git remote set-url origin https://USERNAME@github.com/USERNAME/REPOSITORY.git
```

## Pre-commit

```bash
npx vp hooks status
git config --unset core.hooksPath
npx vp hooks enable
```
