#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# create-secrets.sh
# Crea todos los Kubernetes Secrets necesarios en el namespace dado.
# USO: ./create-secrets.sh production
#      ./create-secrets.sh staging
#
# IMPORTANTE: nunca commitees este archivo con valores reales.
# Usa variables de entorno o un gestor de secretos (Vault, DO Secrets).
# ─────────────────────────────────────────────────────────────────

NS=${1:-production}
JWT_SECRET=${JWT_SECRET:-"cambia_este_valor_en_produccion"}
DB_PASS=${DB_PASS:-"apppass"}

echo "→ Creando secrets en namespace: $NS"

# ── users-secret ──────────────────────────────────────────────────
kubectl create secret generic users-secret \
  --namespace="$NS" \
  --from-literal=DB_PASS="$DB_PASS" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── catalog-secret ────────────────────────────────────────────────
kubectl create secret generic catalog-secret \
  --namespace="$NS" \
  --from-literal=DB_PASS="$DB_PASS" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── orders-secret ─────────────────────────────────────────────────
kubectl create secret generic orders-secret \
  --namespace="$NS" \
  --from-literal=DB_PASS="$DB_PASS" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── payments-secret ───────────────────────────────────────────────
kubectl create secret generic payments-secret \
  --namespace="$NS" \
  --from-literal=DB_PASS="$DB_PASS" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── notifications-secret ──────────────────────────────────────────
kubectl create secret generic notifications-secret \
  --namespace="$NS" \
  --from-literal=PLACEHOLDER="none" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── api-gateway-secret ────────────────────────────────────────────
kubectl create secret generic api-gateway-secret \
  --namespace="$NS" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✓ Todos los secrets creados en '$NS'"
