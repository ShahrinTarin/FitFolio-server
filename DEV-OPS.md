# FitFolio Production DevOps Guide

This repository has been upgraded with a professional, production-grade DevOps environment.

## 📁 Directory Structure
- `Dockerfile`: Multi-stage, secure production build.
- `deploy/charts/fitfolio`: Complete Helm chart for Kubernetes orchestration.
- `terraform/`: Infrastructure as Code for DigitalOcean (Kubernetes + Managed DB).
- `.github/workflows/ci.yml`: Automated CI/CD with security scanning (audit, SHA-tagging).

## 🚀 How to Deploy

### 1. Build & Push Image
The CI/CD pipeline handles this automatically on `push` to `main`. To do it manually:
```bash
docker build -t your-registry/fitfolio-server:latest .
docker push your-registry/fitfolio-server:latest
```

### 2. Provision Infrastructure
Use Terraform to create your cloud resources:
```bash
cd terraform
terraform init
terraform plan -var="do_token=YOUR_TOKEN"
terraform apply -var="do_token=YOUR_TOKEN"
```

### 3. Deploy to Kubernetes
Use Helm to install the application:
```bash
helm install fitfolio ./deploy/charts/fitfolio \
  --set secrets.MONGODB_URI="your-connection-string" \
  --set secrets.JWT_SECRET_KEY="your-secret"
```

## 📊 Monitoring
The application now exposes a **Prometheus** metrics endpoint at:
- `GET /metrics`

It also includes probes for Kubernetes:
- `GET /health` (Liveness)
- `GET /ready` (Readiness - checks DB connection)

## 🛡️ Security
- **Non-root**: The container runs under the `node` user for security.
- **CI Scanning**: Every PR is audited for vulnerabilities via `npm audit`.
- **Secrets Management**: Sensitive data is handled via Kubernetes Secrets, not environment variables in the image.
