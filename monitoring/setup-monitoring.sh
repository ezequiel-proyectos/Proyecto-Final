#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# setup-monitoring.sh
# Instala el stack de observabilidad completo en el namespace monitoring:
#   - Prometheus  (recolección de métricas)
#   - Grafana     (visualización)
#   - Alertmanager (alertas)
#
# Pre-requisito: haber ejecutado setup-cluster.sh primero.
# USO: GRAFANA_PASS=mipassword ./setup-monitoring.sh
# ─────────────────────────────────────────────────────────────────

set -e

GRAFANA_PASS=${GRAFANA_PASS:-"admin123"}
NAMESPACE="monitoring"

echo "→ Agregando repo kube-prometheus-stack..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

echo "→ Instalando kube-prometheus-stack en namespace '$NAMESPACE'..."
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --values monitoring/prometheus/values.yaml \
  --set grafana.adminPassword="$GRAFANA_PASS" \
  --wait \
  --timeout 10m

echo ""
echo "✅ Stack de monitoreo instalado."
echo ""
echo "Para acceder a Grafana localmente:"
echo "  kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring"
echo "  → http://localhost:3000  (usuario: admin, pass: $GRAFANA_PASS)"
echo ""
echo "Para acceder a Prometheus:"
echo "  kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090 -n monitoring"
echo "  → http://localhost:9090"
