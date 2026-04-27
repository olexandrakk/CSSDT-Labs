set -e

echo "=== Починаємо автоматичне розгортання Task Tracker ==="

echo "[1/8] Оновлення системи та встановлення системних пакетів..."
sudo apt-get update
sudo apt-get install -y curl dirmngr apt-transport-https lsb-release ca-certificates nginx postgresql postgresql-contrib

if ! command -v node > /dev/null; then
    echo "Встановлення Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js вже встановлено."
fi

echo "Системні пакети успішно встановлено!"

echo "[2/8] Налаштування користувачів системи..."

create_user() {
    if id "$1" &>/dev/null; then
        echo "Користувач $1 вже існує."
    else
        sudo useradd -m -s /bin/bash "$1"
        echo "$1:$2" | sudo chpasswd
        echo "Користувача $1 створено."
    fi
}

create_user teacher 12345678
sudo usermod -aG sudo teacher

create_user operator 12345678

if id "app" &>/dev/null; then
    echo "Користувач app вже існує."
else
    sudo useradd -r -s /bin/false app
    echo "Системного користувача app створено."
fi

echo "Налаштування sudo-прав для operator..."
echo "operator ALL=(ALL) NOPASSWD: /usr/bin/systemctl start mywebapp, /usr/bin/systemctl stop mywebapp, /usr/bin/systemctl restart mywebapp, /usr/bin/systemctl status mywebapp, /usr/bin/systemctl reload nginx" | sudo tee /etc/sudoers.d/operator > /dev/null
sudo chmod 0440 /etc/sudoers.d/operator


echo "[3/8] Налаштування бази даних PostgreSQL..."

sudo -u postgres psql -c "CREATE USER student WITH PASSWORD '12345678';" || true
sudo -u postgres psql -c "CREATE DATABASE lab1db OWNER student;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lab1db TO student;" || true

echo "База даних налаштована."

echo "[4/8] Розгортання файлів застосунку..."

sudo mkdir -p /opt/mywebapp
sudo mkdir -p /etc/mywebapp

sudo cp -r ./* /opt/mywebapp/
sudo cp ./config.json /etc/mywebapp/config.json

cd /opt/mywebapp
sudo npm install

sudo chown -R app:app /opt/mywebapp
sudo chown -R app:app /etc/mywebapp

echo "[5/8] Налаштування Systemd..."
sudo bash -c 'cat > /etc/systemd/system/mywebapp.service <<EOF
[Unit]
Description=My Web App (Task Tracker)
After=network.target postgresql.service

[Service]
Type=simple
User=app
WorkingDirectory=/opt/mywebapp
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable mywebapp
sudo systemctl restart mywebapp

echo "[6/8] Налаштування Nginx..."
sudo bash -c 'cat > /etc/nginx/sites-available/mywebapp <<EOF
server {
    listen 80;
    server_name _;

    # Записуємо логи (вимога лаби)
    access_log /var/log/nginx/mywebapp_access.log;
    error_log /var/log/nginx/mywebapp_error.log;

    # Дозволяємо тільки кореневий ендпоінт і бізнес-логіку (tasks)
    location = / {
        proxy_pass http://127.0.0.1:3000;
    }

    location /tasks {
        proxy_pass http://127.0.0.1:3000;
    }

    # Блокуємо ззовні ендпоінти health та інші можливі шляхи
    location / {
        return 404;
    }
}
EOF'

sudo ln -sf /etc/nginx/sites-available/mywebapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "[7/8] Створення файлу gradebook..."
echo "7" | sudo tee /home/student/gradebook > /dev/null
sudo chown student:student /home/student/gradebook

echo "[8/8] Блокування дефолтного користувача..."
DEFAULT_USER=$(logname)
if [ "$DEFAULT_USER" != "student" ] && [ "$DEFAULT_USER" != "teacher" ] && [ "$DEFAULT_USER" != "operator" ]; then
    echo "Блокуємо $DEFAULT_USER..."
    sudo usermod -L "$DEFAULT_USER" || true
fi

echo "=== Встановлення успішно завершено! ==="