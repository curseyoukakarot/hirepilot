/**
 * Verifies task email template renderers return valid subject/html/text.
 * Run: npx ts-node scripts/test-task-email-templates.ts
 */
import {
  renderTaskAssignedEmail,
  renderTaskCommentEmail,
  renderTaskCompletedEmail,
  type TaskEmailBrand,
} from '../src/emails/tasksEmailTemplates';

const BRAND: TaskEmailBrand = {
  appName: 'HirePilot',
  appUrl: 'https://app.thehirepilot.com',
  logoUrl: 'https://app.thehirepilot.com/logo-light.png',
  accent: '#7C3AED',
  supportEmail: 'support@thehirepilot.com',
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function testAssigned() {
  const result = renderTaskAssignedEmail(BRAND, {
    workspaceName: 'Test Workspace',
    taskId: 'task-123',
    taskTitle: 'Review PR #42',
    taskDescription: 'Please review the changes.',
    taskStatus: 'Open',
    taskPriority: 'High',
    dueAt: 'Fri, Mar 1 at 3:00 PM',
    relatedLabel: 'Linked to: Senior Backend Engineer (Job Req)',
    relatedUrl: null,
    taskUrl: 'https://app.thehirepilot.com/tasks?taskId=task-123',
    assigneeName: 'Jane Doe',
    assignerName: 'John Smith',
    assignerEmail: 'john@example.com',
  });

  assert(typeof result.subject === 'string' && result.subject.length > 0, 'assigned: subject');
  assert(typeof result.html === 'string' && result.html.includes('<!doctype html>'), 'assigned: html');
  assert(typeof result.text === 'string' && result.text.length > 0, 'assigned: text');
  assert(result.subject.includes('Task assigned'), 'assigned: subject contains label');
  assert(result.html.includes('John Smith'), 'assigned: html contains assigner');
  console.log('✅ renderTaskAssignedEmail OK');
}

function testComment() {
  const result = renderTaskCommentEmail(BRAND, {
    workspaceName: 'Test Workspace',
    taskId: 'task-123',
    taskTitle: 'Review PR #42',
    taskStatus: 'In Progress',
    taskPriority: 'Medium',
    dueAt: 'Fri, Mar 1 at 3:00 PM',
    relatedLabel: null,
    relatedUrl: null,
    taskUrl: 'https://app.thehirepilot.com/tasks?taskId=task-123',
    assigneeName: 'Jane Doe',
    commenterName: 'John Smith',
    commentPreview: 'This looks good to me. Let me know if you have any feedback!',
    commentUrl: 'https://app.thehirepilot.com/tasks?taskId=task-123',
  });

  assert(typeof result.subject === 'string' && result.subject.length > 0, 'comment: subject');
  assert(typeof result.html === 'string' && result.html.includes('<!doctype html>'), 'comment: html');
  assert(typeof result.text === 'string' && result.text.length > 0, 'comment: text');
  assert(result.subject.includes('Comment'), 'comment: subject contains label');
  assert(result.html.includes('This looks good'), 'comment: html contains preview');
  console.log('✅ renderTaskCommentEmail OK');
}

function testCompleted() {
  const result = renderTaskCompletedEmail(BRAND, {
    workspaceName: 'Test Workspace',
    taskId: 'task-123',
    taskTitle: 'Review PR #42',
    taskStatus: 'Completed',
    taskPriority: 'High',
    dueAt: 'Fri, Mar 1 at 3:00 PM',
    relatedLabel: null,
    relatedUrl: null,
    taskUrl: 'https://app.thehirepilot.com/tasks?taskId=task-123',
    assigneeName: 'Jane Doe',
    assignerName: 'John Smith',
    completedAt: 'Thu, Feb 27 at 2:15 PM',
  });

  assert(typeof result.subject === 'string' && result.subject.length > 0, 'completed: subject');
  assert(typeof result.html === 'string' && result.html.includes('<!doctype html>'), 'completed: html');
  assert(typeof result.text === 'string' && result.text.length > 0, 'completed: text');
  assert(result.subject.includes('Completed'), 'completed: subject contains label');
  assert(result.html.includes('Jane Doe') || result.html.includes('John Smith'), 'completed: html contains participant');
  console.log('✅ renderTaskCompletedEmail OK');
}

function main() {
  testAssigned();
  testComment();
  testCompleted();
  console.log('\nAll template renderer tests passed.');
}

main();
