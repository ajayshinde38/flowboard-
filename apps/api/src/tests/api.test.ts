import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';

const app = createApp();

function extractCookies(res: request.Response): { cookieHeader: string; csrfToken: string } {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const pairs: string[] = [];
  let csrfToken = '';
  for (const c of list) {
    const first = c.split(';')[0];
    pairs.push(first);
    if (first.startsWith('fb_csrf_token=')) {
      csrfToken = decodeURIComponent(first.slice('fb_csrf_token='.length));
    }
  }
  return { cookieHeader: pairs.join('; '), csrfToken };
}

describe('FlowBoard API Integration Suite', () => {
  beforeAll(async () => {
    await prisma.$transaction([
      prisma.notification.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.taskComment.deleteMany(),
      prisma.taskLabel.deleteMany(),
      prisma.task.deleteMany(),
      prisma.label.deleteMany(),
      prisma.projectMember.deleteMany(),
      prisma.project.deleteMany(),
      prisma.workspaceMember.deleteMany(),
      prisma.workspace.deleteMany(),
      prisma.refreshSession.deleteMany(),
      prisma.passwordResetToken.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  let userACookie = '';
  let userACsrf = '';
  let workspaceAId = '';
  let userBCookie = '';
  let userBCsrf = '';
  let projectAId = '';
  let task1Id = '';
  let task2Id = '';
  let task3Id = '';

  it('health check responds 200 ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('registers User A, issues HttpOnly + CSRF cookies, and creates default workspace', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Owner',
      email: 'alice@example.com',
      password: 'Password123',
      workspaceName: 'Alice Studio',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.workspaces).toHaveLength(1);
    expect(res.body.workspaces[0].name).toBe('Alice Studio');

    const { cookieHeader, csrfToken } = extractCookies(res);
    expect(cookieHeader).toContain('fb_access_token=');
    expect(cookieHeader).toContain('fb_refresh_token=');
    expect(csrfToken).toBeTruthy();

    userACookie = cookieHeader;
    userACsrf = csrfToken;
    workspaceAId = res.body.workspaces[0].id;
  });

  it('rejects state-changing cookie-authenticated requests without CSRF header', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', userACookie)
      .send({
        workspaceId: workspaceAId,
        name: 'Blocked Project',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid input with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({
        workspaceId: workspaceAId,
        name: 'A',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates, updates, and fetches projects in Workspace A', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({
        workspaceId: workspaceAId,
        name: 'Apollo Launch',
        key: 'APL',
        priority: 'HIGH',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.project.key).toBe('APL');
    projectAId = createRes.body.project.id;

    const patchRes = await request(app)
      .patch(`/api/v1/projects/${projectAId}`)
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({ status: 'ACTIVE', description: 'Mission critical release' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.project.description).toBe('Mission critical release');
  });

  it('creates tasks, orders them stably, moves across Kanban columns, and detects version conflicts', async () => {
    const t1 = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({ workspaceId: workspaceAId, projectId: projectAId, title: 'Task One', status: 'TODO' });
    const t2 = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({ workspaceId: workspaceAId, projectId: projectAId, title: 'Task Two', status: 'TODO' });
    const t3 = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({ workspaceId: workspaceAId, projectId: projectAId, title: 'Task Three', status: 'TODO' });

    expect(t1.status).toBe(201);
    expect(t2.status).toBe(201);
    expect(t3.status).toBe(201);
    task1Id = t1.body.task.id;
    task2Id = t2.body.task.id;
    task3Id = t3.body.task.id;
    expect(t1.body.task.position).toBeLessThan(t2.body.task.position);
    expect(t2.body.task.position).toBeLessThan(t3.body.task.position);

    // Move Task Three between Task One and Task Two
    const moveRes = await request(app)
      .patch(`/api/v1/tasks/${task3Id}/move`)
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({
        status: 'TODO',
        beforeTaskId: task1Id,
        afterTaskId: task2Id,
        expectedVersion: 1,
      });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.task.position).toBeGreaterThan(t1.body.task.position);
    expect(moveRes.body.task.position).toBeLessThan(t2.body.task.position);
    expect(moveRes.body.task.version).toBe(2);

    // Stale version should fail with 409 CONFLICT
    const conflictRes = await request(app)
      .patch(`/api/v1/tasks/${task3Id}/move`)
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({
        status: 'DONE',
        expectedVersion: 1,
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('CONFLICT');

    // Valid version moves to DONE
    const doneRes = await request(app)
      .patch(`/api/v1/tasks/${task3Id}/move`)
      .set('Cookie', userACookie)
      .set('X-CSRF-Token', userACsrf)
      .send({
        status: 'DONE',
        expectedVersion: 2,
      });

    expect(doneRes.status).toBe(200);
    expect(doneRes.body.task.status).toBe('DONE');
    expect(doneRes.body.task.completedAt).toBeTruthy();
  });

  it('enforces strict cross-workspace isolation against User B', async () => {
    const regB = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Outsider',
      email: 'bob@example.com',
      password: 'Password123',
      workspaceName: 'Bob Workspace',
    });
    expect(regB.status).toBe(201);
    const extracted = extractCookies(regB);
    userBCookie = extracted.cookieHeader;
    userBCsrf = extracted.csrfToken;

    // User B tries to read User A's project
    const projAttempt = await request(app)
      .get(`/api/v1/projects/${projectAId}`)
      .set('Cookie', userBCookie);
    expect(projAttempt.status).toBe(403);

    // User B tries to read User A's task
    const taskAttempt = await request(app)
      .get(`/api/v1/tasks/${task1Id}`)
      .set('Cookie', userBCookie);
    expect(taskAttempt.status).toBe(403);

    // User B tries to mutate User A's task
    const mutateAttempt = await request(app)
      .patch(`/api/v1/tasks/${task1Id}`)
      .set('Cookie', userBCookie)
      .set('X-CSRF-Token', userBCsrf)
      .send({ title: 'Hacked title' });
    expect(mutateAttempt.status).toBe(403);

    // User B tries to query User A's analytics
    const analyticsAttempt = await request(app)
      .get(`/api/v1/analytics/overview?workspaceId=${workspaceAId}`)
      .set('Cookie', userBCookie);
    expect(analyticsAttempt.status).toBe(403);
  });

  it('computes real analytics from stored workspace records', async () => {
    const res = await request(app)
      .get(`/api/v1/analytics/overview?workspaceId=${workspaceAId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.kpis.totalProjects).toBe(1);
    expect(res.body.kpis.totalTasks).toBe(3);
    expect(res.body.kpis.completedTasks).toBe(1);
    expect(res.body.kpis.activeTasks).toBe(2);
    expect(res.body.kpis.completionRate).toBe(33);
  });

  it('rotates refresh tokens and handles password reset cleanly', async () => {
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', userACookie);
    expect(refreshRes.status).toBe(200);

    // Forgot & reset password for Bob
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'bob@example.com' });
    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.devResetToken).toBeTruthy();

    const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
      token: forgotRes.body.devResetToken,
      password: 'NewPassword456',
    });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@example.com',
      password: 'NewPassword456',
    });
    expect(loginRes.status).toBe(200);
  });
});
