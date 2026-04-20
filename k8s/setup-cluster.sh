#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# setup-cluster.sh
# Configura el cluster DOKS con todo lo necesario para el proyecto.
# Ejecutar UNA SOLA VEZ después de crear el cluster en DigitalOcean.
#
# Pre-requisitos:
#   - doctl instalado y autenticado (doctl auth init)
#   - kubectl instalado
#   - helm instalado (v3+)
#   - Cluster DOKS ya creado en DigitalOcean
#
# USO: CLUSTER_NAME=mi-cluster ./setup-cluster.sh
# ─────────────────────────────────────────────────────────────────

set -e

CLUSTER_NAME=${CLUSTER_NAME:-"food-order-cluster"}
echo "→ Conectando al cluster: $CLUSTER_NAME"
doctl kubernetes cluster kubeconfig save "$CLUSTER_NAME"

# ── 1. Namespaces ─────────────────────────────────────────────────
echo "→ Creando namespaces..."
kubectl apply -f k8s/namespaces/namespaces.yaml

# ── 2. Ingress NGINX ──────────────────────────────────────────────
echo "→ Instalando Ingress NGINX..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2 \
  --set controller.service.type=LoadBalancer \
  --wait

echo "→ IP del LoadBalancer:"
kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
echo ""

# ── 3. cert-manager (TLS automático con Let's Encrypt) ───────────
echo "→ Instalando cert-manager..."
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true \
  --wait

# ClusterIssuer para Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LETSENCRYPT_EMAIL:-"tu@email.com"}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# ── 4. Metrics Server (necesario para HPA) ────────────────────────
echo "→ Instalando Metrics Server..."
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system \
  --set args={--kubelet-insecure-tls}

# ── 5. Bases de datos MySQL en production ─────────────────────────
echo "→ Desplegando MySQL en production..."
kubectl apply -f k8s/mysql/mysql-users.yaml
# Repite para los otros servicios cuando los crees

# ── 6. Secrets ────────────────────────────────────────────────────
echo "→ Creando secrets..."
chmod +x k8s/secrets/create-secrets.sh
JWT_SECRET="${JWT_SECRET:-cambia_esto}" \
DB_PASS="${DB_PASS:-apppass}" \
  ./k8s/secrets/create-secrets.sh production

JWT_SECRET="${JWT_SECRET:-cambia_esto}" \
DB_PASS="${DB_PASS:-apppass}" \
  ./k8s/secrets/create-secrets.sh staging

echo ""
echo "✅ Cluster configurado correctamente."
echo ""
echo "Próximos pasos:"
echo "  1. Agrega la IP del LoadBalancer a tu DNS apuntando a api.foodorder.example.com"
echo "  2. Configura los GitHub Secrets (DO_ACCESS_TOKEN, DOKS_CLUSTER_NAME, etc.)"
echo "  3. Haz push a main para triggear el primer pipeline"
