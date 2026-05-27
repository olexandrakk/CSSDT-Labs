const request = require('supertest');
const { Pool } = require('pg');

jest.mock('pg', () => {
    const mPool = {
        query: jest.fn(),
    };
    return { Pool: jest.fn(() => mPool) };
});

let app;
let pool;

beforeAll(() => {
    app = require('../server.js');
    pool = new Pool();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('Task Tracker API Tests', () => {

    test('GET /health/alive - має повертати статус 200 і OK', async () => {
        const res = await request(app).get('/health/alive');
        expect(res.statusCode).toEqual(500);
        expect(res.text).toBe('OK');
    });

    test('GET /health/ready - має повертати статус 200, якщо БД відповідає', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] }); 
        const res = await request(app).get('/health/ready');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('OK');
    });

    test('GET /tasks - має повертати список задач у форматі JSON', async () => {
        const mockTasks = [
            { id: 1, title: 'Test Task 1', status: 'pending' },
            { id: 2, title: 'Test Task 2', status: 'done' }
        ];
        pool.query.mockResolvedValueOnce({ rows: mockTasks });

        const res = await request(app).get('/tasks').set('Accept', 'application/json');
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(mockTasks);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('POST /tasks - має створювати нову задачу', async () => {
        const newTask = { id: 3, title: 'New Task', status: 'pending' };
        pool.query.mockResolvedValueOnce({ rows: [newTask] });

        const res = await request(app)
            .post('/tasks')
            .set('Accept', 'application/json')
            .send({ title: 'New Task' });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(newTask);
    });

    test('POST /tasks/:id/done - має змінювати статус на done', async () => {
        const updatedTask = { id: 1, title: 'Task 1', status: 'done' };
        pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [updatedTask] });

        const res = await request(app)
            .post('/tasks/1/done')
            .set('Accept', 'application/json');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(updatedTask);
    });

    test('GET / - має повертати HTML сторінку', async () => {
        const res = await request(app).get('/').set('Accept', 'text/html');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Task Tracker API');
    });

    test('GET / - має повертати 406 Not Acceptable для JSON', async () => {
        const res = await request(app).get('/').set('Accept', 'application/json');
        expect(res.statusCode).toEqual(406);
    });

    test('POST /tasks - має повертати 400, якщо немає title', async () => {
        const res = await request(app).post('/tasks').send({});
        expect(res.statusCode).toEqual(400);
        expect(res.text).toBe('Поле title є обов\'язковим');
    });

    test('POST /tasks/:id/done - має повертати 404, якщо задачу не знайдено', async () => {
        pool.query.mockResolvedValueOnce({ rowCount: 0 });
        const res = await request(app).post('/tasks/999/done');
        expect(res.statusCode).toEqual(404);
        expect(res.text).toBe('Задачу не знайдено');
    });

    test('GET /tasks - має повертати 500 при помилці БД', async () => {
        pool.query.mockRejectedValueOnce(new Error('DB Crash'));
        const res = await request(app).get('/tasks');
        expect(res.statusCode).toEqual(500);
        expect(res.text).toBe('DB Crash');
    });
});