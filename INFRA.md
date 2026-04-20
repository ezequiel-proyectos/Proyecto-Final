# Infraestructura & CI/CD — Food Order System

## Arquitectura en DOKS

```
Internet
   │
   ▼
LoadBalancer (DigitalOcean)
   │
   ▼
Ingress NGINX  ←─── TLS via cert-manager (Let's Encrypt)
   │
   ▼
api-gateway  (Namespace: production)
   │
   ├──► users-svc:3001
   ├──► catalog-svc:3002
   ├──► orders-svc:3003
   ├──► payments-svc:3004
   └──► notifications-svc:3005
         cada uno con su MySQL StatefulSet
```

## GitHub Secrets requeridos

Configúralos en **Settings → Secrets and variables → Actions**:

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `DO_ACCESS_TOKEN` | Token de API de DigitalOcean | `dop_v1_xxxx` |
| `DO_REGISTRY_NAME` | Nombre del registry | `mi-registry` |
| `DOKS_CLUSTER_NAME` | Nombre del cluster Kubernetes | `food-order-cluster` |
| `JWT_SECRET` | Clave secreta para JWT | string largo y aleatorio |
| `DB_PASS` | Contraseña de MySQL | string seguro |

## Pipeline CI/CD

```
push a main
     │
     ├─ [paralelo] Lint de los 6 servicios
     │
     ├─ [paralelo] Build & Push Docker → DO Registry
     │              (tagged con SHA corto + latest)
     │
     ├─ Deploy → Staging (helm upgrade --wait)
     │
     ├─ Smoke Tests en Staging
     │    ├─ Health check del gateway
     │    ├─ Test de registro de usuario
     │    └─ Test de listado de catálogo
     │
     └─ Deploy → Production (helm upgrade --atomic)
          └─ Si falla → rollback automático a versión anterior
```

## Comandos útiles de operación

```bash
# Ver estado de todos los pods
kubectl get pods -n production
kubectl get pods -n staging

# Ver HPA (autoscaling)
kubectl get hpa -n production

# Ver logs de un servicio
kubectl logs -n production -l app=orders --tail=100 -f

# Escalar manualmente un deployment
kubectl scale deployment users -n production --replicas=3

# Rollback manual de helm
helm rollback food-order-prod 1 -n production

# Ver historial de releases de helm
helm history food-order-prod -n production

# Ver todos los releases
helm list -A

# Ejecutar un pod temporal para debug interno
kubectl run debug --rm -it --image=alpine -n production -- sh
```

## Setup inicial del cluster (solo una vez)

```bash
# 1. Crear el cluster en DigitalOcean (desde la consola web o doctl)
doctl kubernetes cluster create food-order-cluster \
  --region nyc1 \
  --size s-2vcpu-4gb \
  --count 3

# 2. Configurar todo lo demás con el script incluido
CLUSTER_NAME=food-order-cluster \
JWT_SECRET=mi_jwt_secreto_largo \
DB_PASS=mi_password_seguro \
LETSENCRYPT_EMAIL=tu@email.com \
  ./k8s/setup-cluster.sh
```

## Estructura de archivos de infraestructura

```
helm/
├── charts/
│   ├── users/          ← Chart individual (Deployment + Service + HPA)
│   ├── catalog/
│   ├── orders/
│   ├── payments/
│   ├── notifications/
│   └── api-gateway/    ← Incluye además el Ingress
└── food-order/         ← Chart paraguas que agrupa todos

k8s/
├── namespaces/         ← production, staging, monitoring
├── secrets/            ← Script para crear los Kubernetes Secrets
└── mysql/              ← StatefulSets de MySQL por servicio

.github/workflows/
└── ci-cd.yml           ← Pipeline completo de 5 etapas
```
