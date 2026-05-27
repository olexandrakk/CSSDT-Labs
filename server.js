const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static('public'));
}

const configPath = fs.existsSync('/etc/mywebapp/config.json') 
    ? '/etc/mywebapp/config.json' 
    : path.join(__dirname, 'config.json');

let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
    config = { db: {}, app: { port: 3000 } };
}

const pool = new Pool(config.db);

async function runMigrations() {
    try {
        const sqlPath = path.join(__dirname, 'init.sql');
        if (fs.existsSync(sqlPath)) {
            const sql = fs.readFileSync(sqlPath, 'utf8');
            await pool.query(sql);
            console.log('Міграції бази даних успішно виконані.');
        }
    } catch (err) {
        console.error('Помилка міграції:', err);
    }
}

function sendResponse(req, res, data, htmlTemplate) {
    if (req.accepts('html')) {
        res.send(htmlTemplate);
    } else {
        res.json(data);
    }
}

app.get('/', (req, res) => {
    if (!req.accepts('html')) return res.status(406).send('Not Acceptable');
    res.send(`<h1>Task Tracker API</h1><a href="/tasks">Список задач</a>`);
});

app.get('/health/alive', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health/ready', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Помилка: Немає підключення до БД');
    }
});

app.get('/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title, status, created_at FROM tasks ORDER BY id ASC');
        const tasks = result.rows;
        
        let htmlTemplate = '<h1>Список задач</h1><table border="1"><tr><th>ID</th><th>Title</th><th>Status</th></tr>';
        tasks.forEach(t => { htmlTemplate += `<tr><td>${t.id}</td><td>${t.title}</td><td>${t.status}</td></tr>`; });
        htmlTemplate += '</table>';

        sendResponse(req, res, tasks, htmlTemplate);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/tasks', async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).send('Поле title є обов\'язковим');

    try {
        const result = await pool.query(
            'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, status, created_at',
            [title]
        );
        const newTask = result.rows[0];
        sendResponse(req, res, newTask, `<p>Задачу ${newTask.title} створено!</p>`);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/tasks/:id/done', async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE tasks SET status = 'done' WHERE id = $1 RETURNING id, title, status, created_at",
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).send('Задачу не знайдено');
        sendResponse(req, res, result.rows[0], '<p>Статус оновлено!</p>');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

const PORT = config.app.port || 3000;

if (require.main === module) {
    if (process.env.LISTEN_FDS === '1') {
        const fd = 3;
        app.listen({ fd }, async () => {
            console.log('Сервер запущено через Systemd Socket Activation');
            await runMigrations();
        });
    } else {
        app.listen(PORT, async () => {
            console.log(`Сервер запущено на http://localhost:${PORT}`);
            await runMigrations();
        });
    }
}

module.exports = app;