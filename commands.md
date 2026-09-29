## Docker Compose

```bash
docker compose build --no-cache
docker compose up --detach
docker compose stop
docker compose down --rmi all --volumes
```

## Pre-commit

```bash
npx vp hooks status

git config --unset core.hooksPath
npx vp hooks enable

npx vp hooks status
```
