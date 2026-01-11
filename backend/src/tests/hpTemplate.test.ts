import { renderHpTemplate } from '../lib/templates/hpTemplate';

describe('renderHpTemplate', () => {
  it('replaces simple variables', () => {
    expect(renderHpTemplate('Hello {{name}}', { name: 'Ava' })).toBe('Hello Ava');
  });

  it('supports if/else blocks', () => {
    const tpl = 'X {{#if ok}}YES{{else}}NO{{/if}} Y';
    expect(renderHpTemplate(tpl, { ok: true })).toBe('X YES Y');
    expect(renderHpTemplate(tpl, { ok: false })).toBe('X NO Y');
  });

  it('supports nested if blocks', () => {
    const tpl = '{{#if outer}}A {{#if inner}}B{{else}}C{{/if}}{{else}}D{{/if}}';
    expect(renderHpTemplate(tpl, { outer: true, inner: true })).toBe('A B');
    expect(renderHpTemplate(tpl, { outer: true, inner: false })).toBe('A C');
    expect(renderHpTemplate(tpl, { outer: false, inner: true })).toBe('D');
  });

  it('treats empty strings as falsy for if', () => {
    const tpl = '{{#if x}}YES{{else}}NO{{/if}}';
    expect(renderHpTemplate(tpl, { x: '' })).toBe('NO');
    expect(renderHpTemplate(tpl, { x: '  ' })).toBe('NO');
    expect(renderHpTemplate(tpl, { x: 'ok' })).toBe('YES');
  });
});

