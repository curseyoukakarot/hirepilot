import request from 'supertest';
import express from 'express';
import router from './rexWidget';

const app = express();
app.use(express.json());
app.use('/api/rex_widget', router);

describe('rex_widget routes', () => {
  it('GET /config returns object', async () => {
    const res = await request(app).get('/api/rex_widget/config');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });
});


