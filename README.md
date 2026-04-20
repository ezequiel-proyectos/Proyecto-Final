# 🍔 Food Order System — Guía completa del proyecto

Sistema de pedidos de comida con arquitectura de microservicios desplegado
en Kubernetes (DOKS) con CI/CD automatizado y observabilidad.

---

## Índice

1. [Arquitectura general](#arquitectura-general)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Fase 1 — Levantar en local](#fase-1--levantar-en-local)
4. [Fase 2 — Microservicios y API](#fase-2--microservicios-y-api)
5. [Fase 3 — Helm Charts](#fase-3--helm-charts)
6. [Fase 4 — CI/CD con GitHub Actions](#fase-4--cicd-con-github-actions)
7. [Fase 5 — Observabilidad](#fase-5--observabilidad)
8. [Referencia rápida de comandos](#referencia-rápida-de-comandos)

---

## Arquitectura general

```
                  ┌──────────────────────────────────────────┐
                  │           DigitalOcean DOKS               │
  Internet ──────▶│  Ingress NGINX (LoadBalancer + TLS)      │
                  │           │                              │
                  │     API Gateway :8080                    │
                  │    ┌───────┼────────┐                   │
                  │  users  catalog  orders  payments  notif │
                  │   :3001   :3002   :3003   :3004   :3005  │
                  │    │       │       │       │              │
                  │  MySQL  MySQL   MySQL   MySQL   (in-mem) │
                  │                                          │
                  │  monitoring/ → Prometheus + Grafana      │
                  └──────────────────────────────────────────┘
```

**Tecnologías:** Node.js · Express · MySQL · Docker · Kubernetes (DOKS)
Helm · GitHub Actions · DO Container Registry · Prometheus · Grafana

---

## Estructura del repositorio

```
food-order-system/
├── services/
│   ├── api-gateway/          Puerto 8080 — Punto de entrada único
│   ├── users/                Puerto 3001 — Registro, login, perfiles
│   ├── catalog/              Puerto 3002 — Restaurantes y platos
│   ├── orders/               Puerto 3003 — Pedidos y estados
│   ├── payments/             Puerto 3004 — Pagos (simulados)
│   └── notifications/        Puerto 3005 — Email/SMS/Push (simulados)
│       └── src/
│           ├── index.js      Entry point + /health + /metrics
│           ├── metrics.js    Módulo prom-client compartido
│           ├── db/           Conexión MySQL + schema init
│           ├── middleware/   Validación + error handler
│           └── routes/       Endpoints CRUD
├── helm/
│   ├── charts/               Un chart por microservicio
│   │   ├── users/            Deployment + Service + HPA
│   │   ├── catalog/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── notifications/
│   │   └── api-gateway/      + Ingress con TLS
│   └── food-order/           Chart paraguas (agrupa todos)
├── k8s/
│   ├── namespaces/           production · staging · monitoring
│   ├── secrets/              Script para crear K8s Secrets
│   ├── mysql/                StatefulSets de MySQL
│   └── setup-cluster.sh      Setup inicial de DOKS
├── monitoring/
│   ├── prometheus/
│   │   ├── values.yaml       Config de kube-prometheus-stack
│   │   └── service-monitors.yaml  Scraping de los 6 servicios
│   ├── dashboards/
│   │   └── food-order-dashboard.yaml  Dashboard Grafana (9 paneles)
│   └── setup-monitoring.sh   Instalación del stack de monitoreo
├── .github/workflows/
│   └── ci-cd.yml             Pipeline completo de 5 etapas
└── docker-compose.yml        Entorno local completo
```

---

## Fase 1 — Levantar en local

### Pre-requisitos
- Docker Desktop instalado y corriendo
- Docker Compose v2+

```bash
# Levantar todos los servicios (primera vez tarda ~2 min)
docker compose up --build

# Verificar que todo está corriendo
curl http://localhost:8080/health

# Ver logs en tiempo real
docker compose logs -f orders-service
```

---

## Fase 2 — Microservicios y API

Todos los endpoints se acceden vía el **API Gateway en puerto 8080**.

### Flujo completo de un pedido

```bash
# 1. Registrar usuario → obtener token JWT
TOKEN=$(curl -s -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan","email":"juan@test.com","password":"123456"}' \
  | jq -r '.token')

# 2. Crear un restaurante
curl -X POST http://localhost:8080/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{"name":"La Pizzería","category":"italiana","address":"Calle 5"}'

# 3. Agregar un plato
curl -X POST http://localhost:8080/api/dishes \
  -H "Content-Type: application/json" \
  -d '{"restaurant_id":1,"name":"Pizza Margherita","price":12.50}'

# 4. Crear pedido
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"restaurant_id":1,"address":"Mi casa","items":[{"dish_id":1,"quantity":2}]}'

# 5. Pagar
curl -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":1,"amount":25.00,"method":"card"}'

# 6. Actualizar estado
curl -X PATCH http://localhost:8080/api/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"confirmed"}'

# 7. Notificar al usuario
curl -X POST http://localhost:8080/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "channel":"email","recipient":"juan@test.com",
    "event":"order_confirmed",
    "data":{"order_id":1}
  }'
```

### Estados válidos de un pedido

```
pending ──▶ confirmed ──▶ preparing ──▶ on_the_way ──▶ delivered
   │             │
   └─────────────┴──▶ cancelled
```

---

## Fase 3 — Helm Charts

### Desplegar todo el sistema

```bash
cd helm
helm dependency update food-order
helm upgrade --install food-order-prod ./food-order \
  --namespace production \
  --set users.image.tag="abc1234" \
  --set catalog.image.tag="abc1234" \
  --set orders.image.tag="abc1234" \
  --set payments.image.tag="abc1234" \
  --set notifications.image.tag="abc1234" \
  --set api-gateway.image.tag="abc1234"
```

### Rollback manual

```bash
helm rollback food-order-prod 1 -n production
helm history food-order-prod -n production
```

---

## Fase 4 — CI/CD con GitHub Actions

### GitHub Secrets requeridos

| Secret | Descripción |
|--------|-------------|
| `DO_ACCESS_TOKEN` | Token de API de DigitalOcean |
| `DO_REGISTRY_NAME` | Nombre del registry (ej: `mi-registry`) |
| `DOKS_CLUSTER_NAME` | Nombre del cluster Kubernetes |
| `JWT_SECRET` | Clave para firmar tokens JWT |
| `DB_PASS` | Contraseña de MySQL |

### Pipeline — 5 etapas

```
push a main
    │
    ├─[paralelo] Lint de los 6 servicios
    ├─[paralelo] Build & Push → DO Container Registry
    ├─ Deploy → Staging (helm upgrade --wait)
    ├─ Smoke Tests (health + registro + catálogo)
    └─ Deploy → Production (helm upgrade --atomic)
                └─ Si falla → rollback automático
```

### Setup inicial del cluster

```bash
doctl kubernetes cluster create food-order-cluster \
  --region nyc1 --size s-2vcpu-4gb --count 3

CLUSTER_NAME=food-order-cluster \
JWT_SECRET=mi_jwt_secreto \
DB_PASS=mi_db_pass \
LETSENCRYPT_EMAIL=tu@email.com \
  ./k8s/setup-cluster.sh
```

---

## Fase 5 — Observabilidad

### Instalar el stack

```bash
GRAFANA_PASS=mi_password ./monitoring/setup-monitoring.sh
kubectl apply -f monitoring/prometheus/service-monitors.yaml
kubectl apply -f monitoring/dashboards/food-order-dashboard.yaml
```

### Acceder localmente

```bash
# Grafana → http://localhost:3000  (admin / tu_password)
kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring

# Prometheus → http://localhost:9090
kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090 -n monitoring
```

### Métricas expuestas por cada servicio (`/metrics`)

| Métrica | Tipo | Descripción |
|---------|------|-------------|
| `http_requests_total` | Counter | Requests por método, ruta y status |
| `http_request_duration_seconds` | Histogram | Latencia (p50, p95, p99) |
| `nodejs_eventloop_lag_seconds` | Gauge | Lag del event loop |
| `nodejs_heap_used_bytes` | Gauge | Memoria heap usada |

### Alertas configuradas

| Alerta | Condición | Severidad |
|--------|-----------|-----------|
| `PodCrashLooping` | Pod reinicia > 1 vez/min por 2 min | critical |
| `HighResponseLatency` | p95 > 2s por 3 min | warning |
| `HighErrorRate` | Errores 5xx > 5% por 2 min | critical |
| `DeploymentReplicasMismatch` | Réplicas disponibles < deseadas por 5 min | warning |

---

## Referencia rápida de comandos

```bash
# ── Local ──────────────────────────────────────────────────────────
docker compose up --build
docker compose down -v
docker compose logs -f <servicio>

# ── Kubernetes ─────────────────────────────────────────────────────
kubectl get pods -n production
kubectl get hpa -n production
kubectl logs -n production -l app=orders --tail=100 -f
kubectl describe pod <nombre> -n production

# ── Helm ───────────────────────────────────────────────────────────
helm list -A
helm history food-order-prod -n production
helm rollback food-order-prod 1 -n production

# ── Observabilidad ─────────────────────────────────────────────────
kubectl get servicemonitors -n monitoring
kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring
```
