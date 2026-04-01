terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

variable "do_token" {}
variable "region" { default = "nyc1" }

provider "digitalocean" {
  token = var.do_token
}

# 1. Managed Kubernetes Cluster (DOKS)
resource "digitalocean_kubernetes_cluster" "fitfolio" {
  name    = "fitfolio-production-cluster"
  region  = var.region
  version = "1.31.1-do.5" # Update as per DO supported versions

  node_pool {
    name       = "worker-pool"
    size       = "s-2vcpu-4gb" # Recommended for production apps
    node_count = 2
  }
}

# 2. Managed MongoDB Instance
# Note: Using DO Managed DBs for production reliability
resource "digitalocean_database_cluster" "mongodb" {
  name       = "fitfolio-db-cluster"
  engine     = "mongodb"
  version    = "7.0"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

# 3. Static IP (Load Balancer)
# Usually managed by the K8s Ingress Controller
# But we can define an IP if needed

output "cluster_endpoint" {
  value = digitalocean_kubernetes_cluster.fitfolio.endpoint
}

output "database_host" {
  value = digitalocean_database_cluster.mongodb.host
}
