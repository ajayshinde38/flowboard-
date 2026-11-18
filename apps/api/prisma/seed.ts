import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, Priority, ProjectStatus, TaskStatus, WorkspaceRole } from '@prisma/client';
import argon2 from 'argon2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

async function seed() {
  console.log('Seeding FlowBoard isolated demo workspace...');

  // Isolated non-privileged demo password (for local testing & demo sandbox only)
  const demoUserHash = await argon2.hash('ajay', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // Strong separate password for demo teammate accounts
  const teammateHash = await argon2.hash('DemoTeamPass123!', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // 1. Seed isolated Demo Users (ajay is a non-privileged MEMBER in the demo workspace)
  const usersData = [
    {
      email: 'ajay@demo.flowboard.local',
      name: 'Ajay Shinde (Demo)',
      passwordHash: demoUserHash,
      avatarColor: '#2563EB',
      jobTitle: 'Frontend Developer',
      bio: 'Demo account for testing projects, tasks, and board workflows.',
      role: WorkspaceRole.MEMBER,
    },
    {
      email: 'owner@demo.flowboard.local',
      name: 'Maya Patel',
      passwordHash: teammateHash,
      avatarColor: '#0D9488',
      jobTitle: 'Product Manager',
      bio: 'Plans sprints and keeps milestones on schedule.',
      role: WorkspaceRole.OWNER,
    },
    {
      email: 'rohan@demo.flowboard.local',
      name: 'Rohan Verma',
      passwordHash: teammateHash,
      avatarColor: '#4F46E5',
      jobTitle: 'Backend Developer',
      bio: 'REST APIs, PostgreSQL queries, and authentication.',
      role: WorkspaceRole.ADMIN,
    },
    {
      email: 'neha@demo.flowboard.local',
      name: 'Neha Kulkarni',
      passwordHash: teammateHash,
      avatarColor: '#D97706',
      jobTitle: 'UI Designer',
      bio: 'Clean layouts, typography, and responsive design.',
      role: WorkspaceRole.MEMBER,
    },
  ];

  const users = [];
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash: u.passwordHash,
        avatarColor: u.avatarColor,
        jobTitle: u.jobTitle,
        bio: u.bio,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: u.passwordHash,
        avatarColor: u.avatarColor,
        jobTitle: u.jobTitle,
        bio: u.bio,
      },
    });
    users.push({ ...user, role: u.role });
  }

  const [ajay, maya, rohan, neha] = users;

  // 2. Reset & recreate only the isolated Demo Workspace (never touches real user workspaces)
  const existingWs = await prisma.workspace.findUnique({ where: { slug: 'flowboard-demo' } });
  if (existingWs) {
    await prisma.workspace.delete({ where: { id: existingWs.id } });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      slug: 'flowboard-demo',
      description: 'Isolated sandbox workspace with sample projects and tasks for demonstration.',
      ownerId: maya.id,
      members: {
        create: users.map((u) => ({ userId: u.id, role: u.role })),
      },
    },
  });

  // 3. Labels
  const labelDefs = [
    { name: 'Frontend', color: '#2563EB' },
    { name: 'Backend', color: '#0D9488' },
    { name: 'Design', color: '#7C3AED' },
    { name: 'Bug', color: '#DC2626' },
    { name: 'Testing', color: '#D97706' },
  ];

  const labels = await Promise.all(
    labelDefs.map((l) =>
      prisma.label.create({ data: { workspaceId: workspace.id, name: l.name, color: l.color } })
    )
  );
  const labelByName = new Map(labels.map((l) => [l.name, l.id]));

  // 4. Sample Projects
  const projectsData = [
    {
      name: 'Website Redesign',
      key: 'WEB',
      description: 'Refresh landing page layout, navigation bar, and mobile responsiveness.',
      status: ProjectStatus.ACTIVE,
      priority: Priority.HIGH,
      color: '#2563EB',
      ownerId: maya.id,
      startDate: daysFromNow(-25),
      dueDate: daysFromNow(14),
      memberIds: [ajay.id, maya.id, neha.id],
    },
    {
      name: 'Customer Portal',
      key: 'PORT',
      description: 'Build user dashboard, task filtering, and account settings pages.',
      status: ProjectStatus.ACTIVE,
      priority: Priority.URGENT,
      color: '#0D9488',
      ownerId: rohan.id,
      startDate: daysFromNow(-18),
      dueDate: daysFromNow(10),
      memberIds: [ajay.id, rohan.id, maya.id],
    },
    {
      name: 'Mobile App Launch',
      key: 'MOB',
      description: 'Prepare responsive views, login screen, and QA checklist for release.',
      status: ProjectStatus.ACTIVE,
      priority: Priority.MEDIUM,
      color: '#D97706',
      ownerId: neha.id,
      startDate: daysFromNow(-12),
      dueDate: daysFromNow(24),
      memberIds: [ajay.id, neha.id, rohan.id],
    },
    {
      name: 'API Documentation',
      key: 'DOCS',
      description: 'Write clear REST endpoint guides and local setup instructions for new developers.',
      status: ProjectStatus.PLANNING,
      priority: Priority.LOW,
      color: '#64748B',
      ownerId: rohan.id,
      startDate: daysFromNow(-4),
      dueDate: daysFromNow(30),
      memberIds: [rohan.id, ajay.id],
    },
  ];

  const projects = [];
  for (const p of projectsData) {
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        ownerId: p.ownerId,
        name: p.name,
        key: p.key,
        description: p.description,
        status: p.status,
        priority: p.priority,
        color: p.color,
        startDate: p.startDate,
        dueDate: p.dueDate,
        members: { create: p.memberIds.map((userId) => ({ userId })) },
      },
    });
    projects.push(project);
  }

  const [webProj, portProj, mobProj, docsProj] = projects;

  // 5. Realistic Tasks across the 4 main columns (TODO, IN_PROGRESS, IN_REVIEW, DONE)
  const taskSpecs: Array<{
    project: typeof webProj;
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    assigneeId: string | null;
    creatorId: string;
    dueDays: number | null;
    createdDaysAgo: number;
    completedDaysAgo?: number;
    labels: string[];
  }> = [
    // Website Redesign
    {
      project: webProj,
      title: 'Update hero section copy and primary CTA button',
      description: 'Use clear, natural English on the homepage with a Try Demo button.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      assigneeId: neha.id,
      creatorId: maya.id,
      dueDays: -6,
      createdDaysAgo: 20,
      completedDaysAgo: 7,
      labels: ['Design', 'Frontend'],
    },
    {
      project: webProj,
      title: 'Keep desktop sidebar fixed while main page scrolls',
      description: 'Use a viewport-height flex layout so only the main content pane scrolls.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      assigneeId: ajay.id,
      creatorId: maya.id,
      dueDays: -2,
      createdDaysAgo: 14,
      completedDaysAgo: 3,
      labels: ['Frontend'],
    },
    {
      project: webProj,
      title: 'Test navigation drawer on 375px mobile screens',
      description: 'Verify menu button opens the drawer and closes automatically after clicking a link.',
      status: TaskStatus.IN_REVIEW,
      priority: Priority.MEDIUM,
      assigneeId: ajay.id,
      creatorId: neha.id,
      dueDays: 2,
      createdDaysAgo: 9,
      labels: ['Frontend', 'Testing'],
    },
    {
      project: webProj,
      title: 'Fix table padding on small tablet viewports',
      description: 'Ensure horizontal scroll works smoothly without clipping status badges.',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      assigneeId: neha.id,
      creatorId: maya.id,
      dueDays: 5,
      createdDaysAgo: 5,
      labels: ['Frontend', 'Bug'],
    },

    // Customer Portal
    {
      project: portProj,
      title: 'Add search and status filter to My Tasks page',
      description: 'Allow filtering tasks by To Do, In Progress, Review, Done, and priority.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      assigneeId: ajay.id,
      creatorId: rohan.id,
      dueDays: -5,
      createdDaysAgo: 18,
      completedDaysAgo: 5,
      labels: ['Frontend'],
    },
    {
      project: portProj,
      title: 'Connect task status changes to PATCH /api/v1/tasks/:id/move',
      description: 'Save drag-and-drop updates to PostgreSQL and keep card order after refresh.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.URGENT,
      assigneeId: ajay.id,
      creatorId: rohan.id,
      dueDays: 1,
      createdDaysAgo: 10,
      labels: ['Frontend', 'Backend'],
    },
    {
      project: portProj,
      title: 'Add form validation error messages on login screen',
      description: 'Show clear inline feedback when email or password is empty or invalid.',
      status: TaskStatus.DONE,
      priority: Priority.MEDIUM,
      assigneeId: ajay.id,
      creatorId: maya.id,
      dueDays: -3,
      createdDaysAgo: 15,
      completedDaysAgo: 4,
      labels: ['Frontend', 'Testing'],
    },
    {
      project: portProj,
      title: 'Build task detail drawer with comment box',
      description: 'Let teammates edit task title, assignee, deadline, and post comments.',
      status: TaskStatus.IN_REVIEW,
      priority: Priority.HIGH,
      assigneeId: rohan.id,
      creatorId: maya.id,
      dueDays: 3,
      createdDaysAgo: 8,
      labels: ['Frontend', 'Backend'],
    },
    {
      project: portProj,
      title: 'Fix overdue badge date comparison for today',
      description: 'Tasks due today should show "Today" instead of marking them overdue early.',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      assigneeId: ajay.id,
      creatorId: rohan.id,
      dueDays: -1,
      createdDaysAgo: 6,
      labels: ['Bug', 'Frontend'],
    },

    // Mobile App Launch
    {
      project: mobProj,
      title: 'Design light mode color palette and card borders',
      description: 'Use #F8FAFC background, #F1F5F9 sidebar, white cards, and #2563EB blue accents.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      assigneeId: neha.id,
      creatorId: maya.id,
      dueDays: -8,
      createdDaysAgo: 22,
      completedDaysAgo: 10,
      labels: ['Design'],
    },
    {
      project: mobProj,
      title: 'Implement theme toggle between Light and Dark mode',
      description: 'Make light mode default and persist user preference across refreshes.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      assigneeId: ajay.id,
      creatorId: neha.id,
      dueDays: 4,
      createdDaysAgo: 7,
      labels: ['Frontend', 'Design'],
    },
    {
      project: mobProj,
      title: 'Write basic unit tests for login form and board columns',
      description: 'Verify form validation and task status changes with Vitest and React Testing Library.',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      assigneeId: rohan.id,
      creatorId: maya.id,
      dueDays: 8,
      createdDaysAgo: 4,
      labels: ['Testing'],
    },
    {
      project: mobProj,
      title: 'Verify project deletion confirmation modal',
      description: 'Ask for confirmation before deleting a project and its tasks.',
      status: TaskStatus.DONE,
      priority: Priority.LOW,
      assigneeId: maya.id,
      creatorId: maya.id,
      dueDays: -1,
      createdDaysAgo: 11,
      completedDaysAgo: 2,
      labels: ['Testing'],
    },

    // API Documentation
    {
      project: docsProj,
      title: 'Document REST endpoints for projects and tasks',
      description: 'List request parameters, response shapes, and HTTP status codes.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      assigneeId: rohan.id,
      creatorId: rohan.id,
      dueDays: 6,
      createdDaysAgo: 5,
      labels: ['Backend'],
    },
    {
      project: docsProj,
      title: 'Add local setup steps and environment variable examples',
      description: 'Make sure anyone cloning the repo can run the app in under 5 minutes.',
      status: TaskStatus.TODO,
      priority: Priority.LOW,
      assigneeId: ajay.id,
      creatorId: maya.id,
      dueDays: 11,
      createdDaysAgo: 3,
      labels: ['Backend'],
    },
    {
      project: docsProj,
      title: 'Prepare interview Q&A and architecture overview',
      description: 'Explain React hooks, REST API calls, PostgreSQL schema, and Kanban logic clearly.',
      status: TaskStatus.IN_REVIEW,
      priority: Priority.MEDIUM,
      assigneeId: ajay.id,
      creatorId: ajay.id,
      dueDays: 3,
      createdDaysAgo: 2,
      labels: ['Frontend'],
    },
  ];

  const colPositions = new Map<string, number>();
  const projectCounters = new Map<string, number>();
  const createdTasks = [];

  for (const spec of taskSpecs) {
    const nextNum = (projectCounters.get(spec.project.id) ?? 0) + 1;
    projectCounters.set(spec.project.id, nextNum);

    const posKey = `${spec.project.id}:${spec.status}`;
    const pos = (colPositions.get(posKey) ?? 0) + 65536;
    colPositions.set(posKey, pos);

    const createdAt = daysFromNow(-spec.createdDaysAgo);
    const completedAt =
      spec.status === TaskStatus.DONE
        ? daysFromNow(-(spec.completedDaysAgo ?? 1))
        : null;

    const task = await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: spec.project.id,
        creatorId: spec.creatorId,
        assigneeId: spec.assigneeId,
        identifier: `${spec.project.key}-${nextNum}`,
        title: spec.title,
        description: spec.description,
        status: spec.status,
        priority: spec.priority,
        position: pos,
        dueDate: spec.dueDays !== null ? daysFromNow(spec.dueDays) : null,
        completedAt,
        createdAt,
        labels: {
          create: spec.labels
            .map((name) => labelByName.get(name))
            .filter((id): id is string => Boolean(id))
            .map((labelId) => ({ labelId })),
        },
      },
    });
    createdTasks.push(task);
  }

  for (const [projectId, count] of projectCounters.entries()) {
    await prisma.project.update({
      where: { id: projectId },
      data: { taskCounter: count },
    });
  }

  // 6. Sample Comments
  const sampleComments = [
    {
      task: createdTasks[5],
      author: rohan,
      content: 'Tested moving cards across To Do, In Progress, Review, and Done — order stays saved after refresh.',
      daysAgo: 1,
    },
    {
      task: createdTasks[2],
      author: neha,
      content: 'Looks clean on 375px width. Drawer closes nicely right after picking a page.',
      daysAgo: 1,
    },
    {
      task: createdTasks[7],
      author: maya,
      content: 'Great progress! Ready to merge once the comment box tests pass.',
      daysAgo: 2,
    },
  ];

  for (const c of sampleComments) {
    if (!c.task) continue;
    await prisma.taskComment.create({
      data: {
        taskId: c.task.id,
        authorId: c.author.id,
        content: c.content,
        createdAt: daysFromNow(-c.daysAgo),
      },
    });
  }

  // 7. Recent Activity
  const activities = [
    {
      actorId: ajay.id,
      projectId: webProj.id,
      taskId: createdTasks[1].id,
      action: 'TASK_UPDATED',
      entityType: 'TASK',
      entityId: createdTasks[1].id,
      summary: `marked ${createdTasks[1].identifier} as Done`,
      daysAgo: 0.3,
    },
    {
      actorId: rohan.id,
      projectId: portProj.id,
      taskId: createdTasks[5].id,
      action: 'COMMENT_ADDED',
      entityType: 'COMMENT',
      entityId: createdTasks[5].id,
      summary: `commented on ${createdTasks[5].identifier}: "${createdTasks[5].title}"`,
      daysAgo: 0.6,
    },
    {
      actorId: neha.id,
      projectId: webProj.id,
      taskId: createdTasks[2].id,
      action: 'TASK_MOVED',
      entityType: 'TASK',
      entityId: createdTasks[2].id,
      summary: `moved ${createdTasks[2].identifier} to Review`,
      daysAgo: 1.2,
    },
    {
      actorId: maya.id,
      projectId: mobProj.id,
      taskId: null,
      action: 'PROJECT_CREATED',
      entityType: 'PROJECT',
      entityId: mobProj.id,
      summary: `created project "${mobProj.name}"`,
      daysAgo: 2.4,
    },
  ];

  for (const a of activities) {
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        projectId: a.projectId,
        taskId: a.taskId,
        actorId: a.actorId,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        summary: a.summary,
        createdAt: daysFromNow(-a.daysAgo),
      },
    });
  }

  // 8. Sample Notifications for Demo user
  await prisma.notification.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: ajay.id,
        type: 'TASK_COMMENTED',
        title: `New comment on ${createdTasks[5].identifier}`,
        message: 'Rohan Verma: Tested moving cards across columns — order stays saved after refresh.',
        entityType: 'TASK',
        entityId: createdTasks[5].id,
        createdAt: daysFromNow(-0.2),
      },
      {
        workspaceId: workspace.id,
        userId: ajay.id,
        type: 'TASK_ASSIGNED',
        title: 'Task assigned to you',
        message: `Maya Patel assigned you to ${createdTasks[8].identifier}: ${createdTasks[8].title}`,
        entityType: 'TASK',
        entityId: createdTasks[8].id,
        createdAt: daysFromNow(-0.8),
      },
    ],
  });

  console.log('✅ Demo workspace seeded!');
  console.log('   Demo Login (local): username "ajay" / password "ajay" (non-privileged MEMBER)');
  console.log(`   Workspace: ${workspace.name} (${projects.length} projects, ${createdTasks.length} tasks)`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
