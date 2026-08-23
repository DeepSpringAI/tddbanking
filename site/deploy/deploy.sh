#!/usr/bin/env bash
#
# Deploy the tddbanking marketing site to the DeepSpring cluster.
#
#   ./site/deploy/deploy.sh
#
# Uses whatever kubectl context is configured — in the workspace pod that is
# the mounted service-account token, which already has access to cloud-dev.
set -euo pipefail

NS=cloud-dev
NAME=tddbanking-site
HOST=tddbanking.deepspring.co
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="$(dirname "$HERE")"

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }

# ── 1. the host must not already be claimed ──────────────────────────────────
# Nginx resolves two ingresses claiming the same host oldest-first, so applying
# a second one is silently ignored: the rollout succeeds and the old site keeps
# serving. Fail loudly instead.
say "Checking who owns $HOST"
OWNERS="$(kubectl get ingress -A \
  -o jsonpath="{range .items[?(@.spec.rules[0].host=='$HOST')]}{.metadata.namespace}/{.metadata.name}{'\n'}{end}" \
  | grep -v "^${NS}/${NAME}$" || true)"
if [ -n "$OWNERS" ]; then
  echo "ERROR: $HOST is already claimed by:" >&2
  echo "$OWNERS" >&2
  echo "Delete the old ingress first, or nginx will keep serving it." >&2
  exit 1
fi
echo "    free (or already ours)"

# ── 2. the site itself ───────────────────────────────────────────────────────
# Regenerated on every deploy so the ConfigMap always matches the files on disk.
say "Building ConfigMap ${NAME}-static from $SITE"
for f in index.html styles.css app.js favicon.svg; do
  [ -f "$SITE/$f" ] || { echo "ERROR: missing $SITE/$f" >&2; exit 1; }
done

BYTES=$(cat "$SITE"/index.html "$SITE"/styles.css "$SITE"/app.js "$SITE"/favicon.svg | wc -c)
echo "    $BYTES bytes total (ConfigMap limit is 1048576)"
if [ "$BYTES" -gt 900000 ]; then
  echo "ERROR: too close to the 1MiB ConfigMap limit — move to an image build." >&2
  exit 1
fi

kubectl create configmap "${NAME}-static" \
  --namespace "$NS" \
  --from-file=index.html="$SITE/index.html" \
  --from-file=styles.css="$SITE/styles.css" \
  --from-file=app.js="$SITE/app.js" \
  --from-file=favicon.svg="$SITE/favicon.svg" \
  --dry-run=client -o yaml \
  | kubectl apply -f -

kubectl label configmap "${NAME}-static" -n "$NS" --overwrite \
  app.kubernetes.io/name="$NAME" \
  app.kubernetes.io/component=static \
  app.kubernetes.io/part-of=tddbanking >/dev/null

# ── 3. everything that does not change ───────────────────────────────────────
say "Applying manifests"
kubectl apply -f "$HERE/manifests.yaml"

# ── 4. pick up the new content ───────────────────────────────────────────────
# A ConfigMap change does not restart pods, and the kubelet's own refresh can
# take minutes. Restart so a deploy means what it says.
say "Restarting to pick up the new ConfigMap"
kubectl rollout restart deployment/"$NAME" -n "$NS"
kubectl rollout status deployment/"$NAME" -n "$NS" --timeout=120s

say "Live at https://$HOST"
