const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const configPath = fs.existsSync('/etc/mywebapp/config.json') 
    ? '/etc/mywebapp/config.json' 
    : path.join(__dirname, 'config.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const pool = new Pool(config.db);

async function runMigrations() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        await pool.query(sql);
        console.log('Міграції бази даних успішно виконані.');
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
    if (!req.accepts('html')) {
        return res.status(406).send('Not Acceptable');
    }
    res.send(`
        <h1>Task Tracker API</h1>
        <ul>
            <li><a href="/tasks">GET /tasks</a> - Список усіх задач</li>
            <li>POST /tasks - Створити задачу (потрібне поле 'title')</li>
            <li>POST /tasks/1/done - Змінити статус задачі на 'done'</li>
            <li><a href="/health/alive">GET /health/alive</a> - Перевірка стану (alive)</li>
            <li><a href="/health/ready">GET /health/ready</a> - Перевірка БД (ready)</li>
        </ul>
    `);
});

app.get('/health/alive', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health/ready', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Помилка: Немає підключення до бази даних');
    }
});

app.get('/tasks', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title, status, created_at FROM tasks ORDER BY id ASC');
        const tasks = result.rows;
        
        let htmlTemplate = '<h1>Список задач</h1><table border="1"><tr><th>ID</th><th>Title</th><th>Status</th><th>Created At</th></tr>';
        tasks.forEach(t => {
            htmlTemplate += `<tr><td>${t.id}</td><td>${t.title}</td><td>${t.status}</td><td>${t.created_at}</td></tr>`;
        });
        htmlTemplate += '</table><br><a href="/">На головну</a>';

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
        const htmlTemplate = `<p>Задачу створено!</p><table border="1"><tr><th>ID</th><th>Title</th></tr><tr><td>${newTask.id}</td><td>${newTask.title}</td></tr></table><br><a href="/tasks">До списку</a>`;
        
        sendResponse(req, res, newTask, htmlTemplate);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/tasks/:id/done', async (req, res) => {
    const taskId = req.params.id;
    try {
        const result = await pool.query(
            "UPDATE tasks SET status = 'done' WHERE id = $1 RETURNING id, title, status, created_at",
            [taskId]
        );
        
        if (result.rowCount === 0) return res.status(404).send('Задачу не знайдено');
        
        const updatedTask = result.rows[0];
        const htmlTemplate = `<p>Статус оновлено!</p><table border="1"><tr><th>ID</th><th>Title</th><th>Status</th></tr><tr><td>${updatedTask.id}</td><td>${updatedTask.title}</td><td>${updatedTask.status}</td></tr></table><br><a href="/tasks">До списку</a>`;
        
        sendResponse(req, res, updatedTask, htmlTemplate);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

const PORT = config.app.port || 3000;

if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Сервер запущено на http://localhost:${PORT}`);
        await runMigrations();
    });
}

module.exports = app;