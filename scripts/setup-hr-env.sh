#!/usr/bin/env bash
# setup-hr-env.sh
# Crea todos los recursos AWS para la instancia hr.prodecaballito.com
# Idempotente — safe to re-run. Sigue el mismo patrón que setup-voice-*-eventbridge.sh
#
# PREREQS:
#   - AWS CLI v2 configurado con permisos: Lambda, S3, CloudFront, EventBridge, ACM, IAM
#   - jq instalado  (brew install jq | apt install jq)
#
# Uso:
#   bash scripts/setup-hr-env.sh              # crea todo
#   bash scripts/setup-hr-env.sh --dry-run    # solo imprime comandos
#   bash scripts/setup-hr-env.sh --phase N    # corre solo la fase N (1-5)
#
# Fases:
#   1 — Lambda prode-api-hr  (copia config de prode-api)
#   2 — S3 prode-frontend-hr  (hosting estático FE)
#   3 — EventBridge rules  (8 cron jobs → prode-api-hr)
#   4 — ACM certificate  (hr.prodecaballito.com)
#   5 — Instrucciones manuales  (RDS, API Gateway, CloudFront, DNS, GitHub Secrets)

set -euo pipefail

# ─── CONFIG ─────────────────────────────────────────────────────────────────
REGION="us-east-1"
ORIGINAL_LAMBDA="prode-api"
HR_LAMBDA="prode-api-hr"
HR_S3_UPLOADS="prode-uploads-cdelrio"   # mismo bucket, distinta key
HR_S3_FRONTEND="prode-frontend-hr"
HR_DOMAIN="hr.prodecaballito.com"
ORIGINAL_DOMAIN="prodecaballito.com"

# ─── FLAGS ──────────────────────────────────────────────────────────────────
ACTION="apply"
PHASE="all"
for arg in "$@"; do
    case "$arg" in
        --dry-run)   ACTION="dry-run" ;;
        --phase)     shift; PHASE="$1" ;;
        --phase=*)   PHASE="${arg#*=}" ;;
    esac
done

# ─── HELPERS ────────────────────────────────────────────────────────────────
run() {
    if [[ "$ACTION" == "dry-run" ]]; then
        echo "  [dry-run] $*"
    else
        echo "  + $*"
        eval "$@"
    fi
}

header() { echo; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }
ok()     { echo "  ✅ $1"; }
info()   { echo "  ℹ️  $1"; }
warn()   { echo "  ⚠️  $1"; }

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo
echo "  Cuenta AWS:  $ACCOUNT_ID"
echo "  Región:      $REGION"
echo "  Acción:      $ACTION"
echo "  Fase:        $PHASE"

# ════════════════════════════════════════════════════════════════════════════
# FASE 1 — Lambda prode-api-hr
# ════════════════════════════════════════════════════════════════════════════
phase_1_lambda() {
    header "FASE 1 — Lambda: $HR_LAMBDA"

    # Leer config de la Lambda original
    info "Leyendo config de $ORIGINAL_LAMBDA..."
    LAMBDA_CONFIG=$(aws lambda get-function-configuration \
        --function-name "$ORIGINAL_LAMBDA" \
        --region "$REGION" \
        --output json)

    ROLE_ARN=$(echo "$LAMBDA_CONFIG"    | jq -r '.Role')
    RUNTIME=$(echo "$LAMBDA_CONFIG"     | jq -r '.Runtime')
    HANDLER=$(echo "$LAMBDA_CONFIG"     | jq -r '.Handler')
    TIMEOUT=$(echo "$LAMBDA_CONFIG"     | jq -r '.Timeout')
    MEMORY=$(echo "$LAMBDA_CONFIG"      | jq -r '.MemorySize')
    ARCH=$(echo "$LAMBDA_CONFIG"        | jq -r '.Architectures[0] // "x86_64"')

    echo "  Role:        $ROLE_ARN"
    echo "  Runtime:     $RUNTIME"
    echo "  Handler:     $HANDLER"
    echo "  Timeout:     ${TIMEOUT}s"
    echo "  Memory:      ${MEMORY}MB"
    echo "  Arch:        $ARCH"

    # Verificar si ya existe
    if aws lambda get-function --function-name "$HR_LAMBDA" --region "$REGION" &>/dev/null; then
        warn "Lambda $HR_LAMBDA ya existe — skip creación. Para actualizar config corré update-function-configuration manualmente."
    else
        info "Creando Lambda $HR_LAMBDA..."

        # Necesitamos un ZIP inicial. Usamos el último deploy del original en S3.
        # El workflow de deploy ya sube prode-api-hr.zip — si no existe aún usamos el original como seed.
        if aws s3 ls "s3://${HR_S3_UPLOADS}/lambda/prode-api-hr.zip" &>/dev/null; then
            CODE_ARGS="--code S3Bucket=${HR_S3_UPLOADS},S3Key=lambda/prode-api-hr.zip"
            info "Usando ZIP existente: s3://${HR_S3_UPLOADS}/lambda/prode-api-hr.zip"
        else
            CODE_ARGS="--code S3Bucket=${HR_S3_UPLOADS},S3Key=lambda/prode-api.zip"
            warn "ZIP HR no encontrado — usando el del original como seed. Hacer un deploy HR después del merge."
        fi

        run "aws lambda create-function \
            --function-name $HR_LAMBDA \
            --runtime $RUNTIME \
            --role $ROLE_ARN \
            --handler $HANDLER \
            --timeout $TIMEOUT \
            --memory-size $MEMORY \
            --architectures $ARCH \
            --region $REGION \
            $CODE_ARGS"

        ok "Lambda $HR_LAMBDA creada."
    fi

    # Variables de entorno placeholder — ACTUALIZAR con valores reales de la nueva RDS
    info "Configurando env vars placeholder en $HR_LAMBDA..."
    info "(Reemplazá DB_HOST, DB_PASSWORD, JWT_SECRET con los valores reales de la nueva RDS)"

    run "aws lambda update-function-configuration \
        --function-name $HR_LAMBDA \
        --region $REGION \
        --environment 'Variables={
            NODE_ENV=production,
            DB_HOST=REEMPLAZAR_CON_ENDPOINT_RDS_HR,
            DB_PORT=5432,
            DB_NAME=prode_hr,
            DB_USER=postgres,
            DB_PASSWORD=REEMPLAZAR_CON_PASSWORD_RDS_HR,
            JWT_SECRET=REEMPLAZAR_CON_NUEVO_JWT_SECRET,
            JWT_EXPIRES_IN=15m,
            JWT_REFRESH_EXPIRES_IN=7d,
            AWS_S3_BUCKET=prode-uploads-hr,
            CDN_URL=REEMPLAZAR_CON_CDN_HR,
            APP_URL=https://$HR_DOMAIN,
            API_BASE_PATH=/prod,
            RESEND_API_KEY=REEMPLAZAR,
            EMAIL_FROM=noreply@$HR_DOMAIN,
            TWILIO_ACCOUNT_SID=REEMPLAZAR,
            TWILIO_AUTH_TOKEN=REEMPLAZAR,
            TWILIO_WHATSAPP_FROM=REEMPLAZAR,
            VAPID_PUBLIC_KEY=REEMPLAZAR,
            VAPID_PRIVATE_KEY=REEMPLAZAR
        }'"

    ok "Env vars configuradas. Editá los REEMPLAZAR desde AWS Console → Lambda → $HR_LAMBDA → Configuration → Environment variables"
}

# ════════════════════════════════════════════════════════════════════════════
# FASE 2 — S3 Frontend
# ════════════════════════════════════════════════════════════════════════════
phase_2_s3() {
    header "FASE 2 — S3: $HR_S3_FRONTEND"

    if aws s3api head-bucket --bucket "$HR_S3_FRONTEND" 2>/dev/null; then
        warn "Bucket $HR_S3_FRONTEND ya existe — skip."
    else
        run "aws s3api create-bucket \
            --bucket $HR_S3_FRONTEND \
            --region $REGION \
            --create-bucket-configuration LocationConstraint=$REGION"

        # Bloquear acceso público directo (CloudFront es el único origen)
        run "aws s3api put-public-access-block \
            --bucket $HR_S3_FRONTEND \
            --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

        ok "Bucket $HR_S3_FRONTEND creado con acceso público bloqueado."
        info "CloudFront accede via OAC (Origin Access Control) — configurarlo en la distribución."
    fi

    # Bucket de uploads HR
    HR_S3_UPLOADS_HR="prode-uploads-hr"
    if aws s3api head-bucket --bucket "$HR_S3_UPLOADS_HR" 2>/dev/null; then
        warn "Bucket $HR_S3_UPLOADS_HR ya existe — skip."
    else
        run "aws s3api create-bucket \
            --bucket $HR_S3_UPLOADS_HR \
            --region $REGION \
            --create-bucket-configuration LocationConstraint=$REGION"

        run "aws s3api put-public-access-block \
            --bucket $HR_S3_UPLOADS_HR \
            --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

        ok "Bucket $HR_S3_UPLOADS_HR creado."
    fi
}

# ════════════════════════════════════════════════════════════════════════════
# FASE 3 — EventBridge Rules (8 cron jobs)
# ════════════════════════════════════════════════════════════════════════════
phase_3_eventbridge() {
    header "FASE 3 — EventBridge rules → $HR_LAMBDA"

    LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${HR_LAMBDA}"

    # Definición de todas las reglas: nombre, schedule, payload, descripción
    declare -A RULE_SCHEDULES=(
        ["prode-hr-weekly"]="cron(0 10 ? * MON *)"
        ["prode-hr-reminder-cutoff"]="cron(*/10 * * * ? *)"
        ["prode-hr-process-jobs"]="cron(*/5 * * * ? *)"
        ["prode-hr-payment-reminder"]="cron(0 13 * * ? *)"
        ["prode-hr-voice-5day"]="cron(0 17 * * ? *)"
        ["prode-hr-voice-match"]="cron(*/5 * * * ? *)"
        ["prode-hr-upcoming-cutoffs"]="cron(*/10 * * * ? *)"
    )
    declare -A RULE_PAYLOADS=(
        ["prode-hr-weekly"]='{"source":"prode.weekly"}'
        ["prode-hr-reminder-cutoff"]='{"source":"prode.reminder-cutoff"}'
        ["prode-hr-process-jobs"]='{"source":"prode.process-jobs"}'
        ["prode-hr-payment-reminder"]='{"source":"prode.payment-reminder"}'
        ["prode-hr-voice-5day"]='{"source":"prode.voice-5day-reminder"}'
        ["prode-hr-voice-match"]='{"source":"prode.voice-match-reminder"}'
        ["prode-hr-upcoming-cutoffs"]='{"source":"prode.upcoming-cutoffs"}'
    )
    declare -A RULE_DESCRIPTIONS=(
        ["prode-hr-weekly"]="HR: resumen semanal (lunes 10h UTC)"
        ["prode-hr-reminder-cutoff"]="HR: recordatorios pre-cutoff (cada 10 min)"
        ["prode-hr-process-jobs"]="HR: procesar jobs pendientes (cada 5 min)"
        ["prode-hr-payment-reminder"]="HR: recordatorio pago planillas (13h UTC = 10h ART)"
        ["prode-hr-voice-5day"]="HR: voice survey 5 días antes de torneo (17h UTC = 14h ART)"
        ["prode-hr-voice-match"]="HR: voice reminder antes de partidos (cada 5 min)"
        ["prode-hr-upcoming-cutoffs"]="HR: verificar cutoffs próximos (cada 10 min)"
    )

    for RULE_NAME in "${!RULE_SCHEDULES[@]}"; do
        SCHEDULE="${RULE_SCHEDULES[$RULE_NAME]}"
        PAYLOAD="${RULE_PAYLOADS[$RULE_NAME]}"
        DESCRIPTION="${RULE_DESCRIPTIONS[$RULE_NAME]}"
        STATEMENT_ID="${RULE_NAME}-invoke"
        RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}"

        info "Configurando: $RULE_NAME ($SCHEDULE)"

        run "aws events put-rule \
            --region $REGION \
            --name $RULE_NAME \
            --schedule-expression '$SCHEDULE' \
            --state ENABLED \
            --description '$DESCRIPTION'"

        run "aws lambda add-permission \
            --region $REGION \
            --function-name $HR_LAMBDA \
            --statement-id $STATEMENT_ID \
            --action lambda:InvokeFunction \
            --principal events.amazonaws.com \
            --source-arn $RULE_ARN \
            2>/dev/null || echo '  (permiso ya existe, skip)'"

        # Escribir targets JSON a archivo temporal
        TARGETS_FILE="/tmp/targets-${RULE_NAME}.json"
        ESCAPED_PAYLOAD=$(echo "$PAYLOAD" | sed 's/"/\\"/g')
        cat > "$TARGETS_FILE" <<TARGETS
[{"Id":"1","Arn":"${LAMBDA_ARN}","Input":"${ESCAPED_PAYLOAD}"}]
TARGETS

        if [[ "$ACTION" == "dry-run" ]]; then
            echo "  [dry-run] aws events put-targets --rule $RULE_NAME --targets $TARGETS_FILE"
        else
            aws events put-targets \
                --region "$REGION" \
                --rule "$RULE_NAME" \
                --targets "file://${TARGETS_FILE}"
            rm -f "$TARGETS_FILE"
        fi

        ok "$RULE_NAME lista."
    done
}

# ════════════════════════════════════════════════════════════════════════════
# FASE 4 — ACM Certificate
# ════════════════════════════════════════════════════════════════════════════
phase_4_acm() {
    header "FASE 4 — ACM Certificate: $HR_DOMAIN"

    # Verificar si ya existe un cert para este dominio
    EXISTING_CERT=$(aws acm list-certificates \
        --region "$REGION" \
        --query "CertificateSummaryList[?DomainName=='${HR_DOMAIN}'].CertificateArn | [0]" \
        --output text 2>/dev/null || echo "None")

    if [[ "$EXISTING_CERT" != "None" && "$EXISTING_CERT" != "" ]]; then
        warn "Certificado ya existe: $EXISTING_CERT"
        CERT_STATUS=$(aws acm describe-certificate \
            --certificate-arn "$EXISTING_CERT" \
            --region "$REGION" \
            --query 'Certificate.Status' \
            --output text)
        info "Status: $CERT_STATUS"
    else
        info "Solicitando certificado para $HR_DOMAIN..."
        run "aws acm request-certificate \
            --domain-name $HR_DOMAIN \
            --validation-method DNS \
            --region $REGION \
            --tags Key=Project,Value=prode-hr"

        ok "Certificado solicitado. Status: PENDING_VALIDATION"
        echo
        warn "ACCIÓN MANUAL REQUERIDA:"
        echo "  1. Ir a AWS Console → Certificate Manager → encontrar el cert de $HR_DOMAIN"
        echo "  2. Expandir el certificado → copiar el registro CNAME de validación DNS"
        echo "  3. Agregar ese registro CNAME en tu DNS provider (ej: Route 53 / GoDaddy / Namecheap)"
        echo "  4. Esperar ~5 min hasta que el status sea ISSUED"
        echo "  5. Anotar el ARN del certificado para usar en la distribución CloudFront"
    fi
}

# ════════════════════════════════════════════════════════════════════════════
# FASE 5 — Instrucciones manuales (RDS, API GW, CloudFront, DNS, Secrets)
# ════════════════════════════════════════════════════════════════════════════
phase_5_manual() {
    header "FASE 5 — Pasos manuales restantes"

    echo
    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  A. RDS PostgreSQL                                              │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  1. AWS Console → RDS → Create database"
    echo "     - Engine: PostgreSQL (misma versión que prode-db)"
    echo "     - Template: Free tier (db.t3.micro)"
    echo "     - DB identifier: prode-db-hr"
    echo "     - Master username: postgres"
    echo "     - Master password: (nueva, guardala)"
    echo "     - DB name inicial: prode_hr"
    echo "     - Mismo VPC y security group que la RDS actual"
    echo "     - Public access: No (mismo patrón que el original)"
    echo
    echo "  2. Una vez creada, anotar el endpoint:"
    echo "     prode-db-hr.xxxxxxxx.us-east-1.rds.amazonaws.com"
    echo
    echo "  3. Correr migraciones desde tu máquina o desde una Lambda temporal:"
    echo "     DB_HOST=<endpoint-hr> node db/migrate.js"
    echo

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  B. API Gateway                                                 │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  1. AWS Console → API Gateway → Create API → REST API"
    echo "  2. Clonar la API del original (Import from OpenAPI) o:"
    echo "     - Create resource: /{proxy+}"
    echo "     - Method: ANY → Lambda Proxy → prode-api-hr"
    echo "     - Enable CORS"
    echo "     - Deploy → Stage: prod"
    echo "  3. Anotar el endpoint generado (ej: https://abc123.execute-api.us-east-1.amazonaws.com/prod)"
    echo "     → Este valor va en HR_VITE_API_URL y en APP_URL de Lambda HR"
    echo

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  C. CloudFront Distribution                                     │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  1. AWS Console → CloudFront → Create distribution"
    echo "     - Origin: S3 bucket $HR_S3_FRONTEND"
    echo "     - Origin access: Origin Access Control (OAC) — crear nuevo"
    echo "     - Viewer protocol policy: Redirect HTTP to HTTPS"
    echo "     - Alternate domain (CNAME): $HR_DOMAIN"
    echo "     - Custom SSL certificate: (elegir el cert de fase 4 una vez ISSUED)"
    echo "     - Default root object: index.html"
    echo "     - Error pages: 404 → /index.html (para SPA routing)"
    echo "  2. Anotar el Distribution ID → va en HR_CLOUDFRONT_DISTRIBUTION_ID"
    echo "  3. Anotar el CloudFront domain (ej: abc123.cloudfront.net) → va en DNS"
    echo

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  D. DNS                                                         │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  Agregar en tu DNS provider (donde manejás prodecaballito.com):"
    echo
    echo "  hr    CNAME    <cloudfront-domain>.cloudfront.net"
    echo

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  E. Lambda HR — actualizar env vars con valores reales          │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  AWS Console → Lambda → prode-api-hr → Configuration → Environment variables"
    echo "  Reemplazar todos los REEMPLAZAR_CON_* con los valores reales:"
    echo
    echo "  DB_HOST       → endpoint RDS HR (paso A)"
    echo "  DB_PASSWORD   → password RDS HR (paso A)"
    echo "  JWT_SECRET    → nuevo valor aleatorio (openssl rand -hex 32)"
    echo "  CDN_URL       → CloudFront domain del bucket prode-uploads-hr"
    echo "  RESEND_API_KEY, TWILIO_*, VAPID_* → mismos que en prode-api (o nuevos)"
    echo

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  F. GitHub Secrets                                              │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  Ir a cada repo → Settings → Secrets and variables → Actions → New secret"
    echo
    echo "  Repo FE (prode-caballito-fe):"
    echo "    HR_VITE_API_URL               → https://<api-gw-id>.execute-api.us-east-1.amazonaws.com/prod/api"
    echo "    HR_AWS_ACCESS_KEY_ID          → IAM access key"
    echo "    HR_AWS_SECRET_ACCESS_KEY      → IAM secret key"
    echo "    HR_CLOUDFRONT_DISTRIBUTION_ID → Distribution ID CloudFront HR"
    echo
    echo "  Repo BE (prode-caballito-be):"
    echo "    HR_AWS_ACCESS_KEY_ID          → IAM access key"
    echo "    HR_AWS_SECRET_ACCESS_KEY      → IAM secret key"
    echo

    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│  G. Primer deploy                                               │"
    echo "└─────────────────────────────────────────────────────────────────┘"
    echo "  1. Mergear los PRs"
    echo "     - BE: https://github.com/cfdelrio/prode-caballito-be/pull/145"
    echo "     - FE: https://github.com/cfdelrio/prode-caballito-fe/pull/143"
    echo "  2. Ir a Actions → Deploy HR → Run workflow"
    echo "  3. Verificar que https://$HR_DOMAIN carga correctamente"
    echo
    echo "  Smoke test rápido desde terminal:"
    echo "    curl -I https://$HR_DOMAIN"
    echo "    curl https://<api-gw-hr>/prod/api/health"
    echo
}

# ════════════════════════════════════════════════════════════════════════════
# RUNNER
# ════════════════════════════════════════════════════════════════════════════
case "$PHASE" in
    "all") phase_1_lambda; phase_2_s3; phase_3_eventbridge; phase_4_acm; phase_5_manual ;;
    "1")   phase_1_lambda ;;
    "2")   phase_2_s3 ;;
    "3")   phase_3_eventbridge ;;
    "4")   phase_4_acm ;;
    "5")   phase_5_manual ;;
    *)     echo "Fase inválida: $PHASE. Usar 1-5 o 'all'"; exit 1 ;;
esac

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup HR completado para las fases ejecutadas."
echo "  Revisar los ⚠️  arriba si hay pasos manuales pendientes."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
