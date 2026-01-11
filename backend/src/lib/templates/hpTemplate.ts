type Vars = Record<string, any>;

type Node =
  | { type: 'text'; value: string }
  | { type: 'var'; key: string }
  | { type: 'if'; key: string; then: Node[]; else: Node[] };

function isTruthy(val: any): boolean {
  if (val === false || val === null || val === undefined) return false;
  if (typeof val === 'number') return !Number.isNaN(val) && val !== 0;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

function parse(template: string): Node[] {
  const nodes: Node[] = [];

  // Stack frames for nested if-blocks
  const stack: Array<{ key: string; then: Node[]; else: Node[]; inElse: boolean }> = [];

  const pushNode = (n: Node) => {
    const frame = stack[stack.length - 1];
    if (!frame) nodes.push(n);
    else (frame.inElse ? frame.else : frame.then).push(n);
  };

  const tokenRe = /{{\s*(#if\s+[a-zA-Z0-9_]+|else|\/if|[a-zA-Z0-9_]+)\s*}}/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(template))) {
    const start = m.index;
    const end = tokenRe.lastIndex;
    if (start > lastIdx) {
      pushNode({ type: 'text', value: template.slice(lastIdx, start) });
    }

    const token = m[1];
    if (token.startsWith('#if ')) {
      const key = token.slice(4).trim();
      stack.push({ key, then: [], else: [], inElse: false });
    } else if (token === 'else') {
      const frame = stack[stack.length - 1];
      if (frame) frame.inElse = true;
      else pushNode({ type: 'text', value: m[0] }); // stray else; keep literal
    } else if (token === '/if') {
      const frame = stack.pop();
      if (!frame) {
        pushNode({ type: 'text', value: m[0] }); // stray /if; keep literal
      } else {
        pushNode({ type: 'if', key: frame.key, then: frame.then, else: frame.else });
      }
    } else {
      pushNode({ type: 'var', key: token.trim() });
    }

    lastIdx = end;
  }

  if (lastIdx < template.length) {
    pushNode({ type: 'text', value: template.slice(lastIdx) });
  }

  // Unclosed if-blocks: render them as literal text by flattening
  while (stack.length) {
    const frame = stack.pop()!;
    // Best-effort: append an if-node anyway so output isn’t silently truncated
    nodes.push({ type: 'if', key: frame.key, then: frame.then, else: frame.else });
  }

  return nodes;
}

function renderNodes(nodes: Node[], vars: Vars): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += n.value;
    else if (n.type === 'var') {
      const v = vars[n.key];
      out += v == null ? '' : String(v);
    } else if (n.type === 'if') {
      const v = vars[n.key];
      out += renderNodes(isTruthy(v) ? n.then : n.else, vars);
    }
  }
  return out;
}

export function renderHpTemplate(template: string, vars: Vars): string {
  try {
    return renderNodes(parse(String(template || '')), vars || {});
  } catch {
    // Fail open: at least do basic {{var}} substitution
    return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
      const v = (vars || {})[key];
      return v == null ? '' : String(v);
    });
  }
}

