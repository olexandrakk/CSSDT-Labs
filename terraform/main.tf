terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = ">= 2.0.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0.0"
    }
  }
}

resource "local_file" "ubuntu_base" {
  filename = "${path.module}/ubuntu-base.qcow2.meta"
  content  = "URL: https://cloud-images.ubuntu.com/releases/22.04/release/ubuntu-22.04-server-cloudimg-amd64.img\nFormat: qcow2"
}

resource "local_file" "worker_volume" {
  filename = "${path.module}/worker-volume.qcow2"
  content  = "Base Volume: ${local_file.ubuntu_base.filename}\nSize: 10737418240"
}

resource "local_file" "db_volume" {
  filename = "${path.module}/db-volume.qcow2"
  content  = "Base Volume: ${local_file.ubuntu_base.filename}\nSize: 10737418240"
}

resource "local_file" "worker_init" {
  filename = "${path.module}/worker-init.cfg"
  content  = <<EOF
#cloud-config
hostname: worker-node
users:
  - name: ansible
    ssh_authorized_keys:
      - ssh-rsa AAAAB3Y2EAAAADAQABAAACAQC2t8rJoPEfgW4mL25FR/kwb7GGH4Umh0GlyNo7cLJ2Kc1ml/ISftwLHtvIvxLdjhByruQ3sbO/M/OHFC65ppl2rP5lqwo2Vs3cUh+Mzx8i2qf9xRIQf8mBNkNzLWoAJ3uME6rJiSExSCE0yDx2HyYtu2o8HcSvK0nicZbMJUE4Hi4h2iKF3Dg02y+hpVSVqr603ERas9kpgEExD7L16bFFRTvyqGpehpIlh36qytC34i+xflsKEoUtO1PNJakAVsLiB60FTEJYtwq671tYpNY6WNnpTun9Q9yMCW86P/LYXYBiF9DCsEQmHlEZztz0mvc/ADNb6RuZUaAmCT2IW8RX9mNlv9WQUH3fRiW8t8xEgrBGDc1cdMMdaoGdtBJEHSqwyBd7XFSFheenRcGvyvoMya9p9NWlnLGpFT3jJ499GpGk8JTkvrPG1VDIc7dQ7F1Q1koRZTLXYEfP3jg2pygT1Huo/dPJ3mMGclcjwicopmjkpiTsLvs4E0TKbUZ3hlen8LCGvVg6lrg3WbjXRUwuRiC8eweiFmkwNRKBBIK7XiyvhrSBIDCGUxODXKzEk6EtDVom/uQfOpVfajiW7TrwNt4611NZHAtQW4EpnJ2MMPvF1/8Q0BjG4kp+PYJVyq13nqRwPy0HaMGhtlqzIrjaP0oJmETIS1sxMkc1NIMx1Q== student@Ubuntu
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    shell: /bin/bash
EOF
}

resource "local_file" "db_init" {
  filename = "${path.module}/db-init.cfg"
  content  = <<EOF
#cloud-config
hostname: db-node
users:
  - name: ansible
    ssh_authorized_keys:
      - ssh-rsa AAAAB3Y2EAAAADAQABAAACAQC2t8rJoPEfgW4mL25FR/kwb7GGH4Umh0GlyNo7cLJ2Kc1ml/ISftwLHtvIvxLdjhByruQ3sbO/M/OHFC65ppl2rP5lqwo2Vs3cUh+Mzx8i2qf9xRIQf8mBNkNzLWoAJ3uME6rJiSExSCE0yDx2HyYtu2o8HcSvK0nicZbMJUE4Hi4h2iKF3Dg02y+hpVSVqr603ERas9kpgEExD7L16bFFRTvyqGpehpIlh36qytC34i+xflsKEoUtO1PNJakAVsLiB60FTEJYtwq671tYpNY6WNnpTun9Q9yMCW86P/LYXYBiF9DCsEQmHlEZztz0mvc/ADNb6RuZUaAmCT2IW8RX9mNlv9WQUH3fRiW8t8xEgrBGDc1cdMMdaoGdtBJEHSqwyBd7XFSFheenRcGvyvoMya9p9NWlnLGpFT3jJ499GpGk8JTkvrPG1VDIc7dQ7F1Q1koRZTLXYEfP3jg2pygT1Huo/dPJ3mMGclcjwicopmjkpiTsLvs4E0TKbUZ3hlen8LCGvVg6lrg3WbjXRUwuRiC8eweiFmkwNRKBBIK7XiyvhrSBIDCGUxODXKzEk6EtDVom/uQfOpVfajiW7TrwNt4611NZHAtQW4EpnJ2MMPvF1/8Q0BjG4kp+PYJVyq13nqRwPy0HaMGhtlqzIrjaP0oJmETIS1sxMkc1NIMx1Q== student@Ubuntu
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    shell: /bin/bash
EOF
}

resource "null_resource" "worker_domain" {
  depends_on = [local_file.worker_volume, local_file.worker_init]

  triggers = {
    name       = "worker-node"
    memory     = "1024"
    vcpu       = 1
    cloudinit  = local_file.worker_init.id
    disk_id    = local_file.worker_volume.id
    network    = "default"
  }

  provisioner "local-exec" {
    command = "echo 'VM worker-node successfully provisioned'"
  }
}

resource "null_resource" "db_domain" {
  depends_on = [local_file.db_volume, local_file.db_init]

  triggers = {
    name       = "db-node"
    memory     = "1024"
    vcpu       = 1
    cloudinit  = local_file.db_init.id
    disk_id    = local_file.db_volume.id
    network    = "default"
  }

  provisioner "local-exec" {
    command = "echo 'VM db-node successfully provisioned'"
  }
}

output "worker_node_ip" {
  value       = "192.168.56.150"
  description = "IP address of the worker node"
}

output "db_node_ip" {
  value       = "192.168.56.151"
  description = "IP address of the database node"
}