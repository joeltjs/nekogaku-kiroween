// PreToolUse guard: the earlier project (the sibling folder named below) is read-only
// for this build. Kiro passes the tool call as JSON on stdin; exit 2 blocks it and stderr says why.
//
// Only the *target* of a write counts: a file tool's path, or the destination of a shell write
// (redirect, rm, mv, cp, tee, sed -i, git that changes things, a cd into the folder before a write).
// Mentioning the folder in text (docs, steering) is fine, and so are reads and copies out of it.
const SOURCE = ['nihongo', 'learning'].join('-');
const esc = SOURCE.replace(/-/g, '\\-');
const inSource = new RegExp(`(^|[\\s"'=/])\\S*${esc}(/|\\b)`);

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let call = {};
  try { call = JSON.parse(input || '{}'); } catch { process.exit(0); }
  const tool = String(call.tool_name ?? call.toolName ?? call.tool ?? '');
  const args = call.tool_input ?? call.toolInput ?? call.input ?? call.arguments ?? {};
  const block = why => { process.stderr.write(`Blocked (${why}): ../${SOURCE} is the earlier project and must not be changed. Copy what you need into this repo instead.\n`); process.exit(2); };

  if (/bash|shell|execute|command/i.test(tool)) {
    const cmd = String(args.command ?? args.cmd ?? ''), cwd = String(args.cwd ?? '');
    const target = `\\S*${esc}\\S*`;
    const writes = [
      new RegExp(`>>?\\s*${target}`),                                   // redirect into it
      new RegExp(`\\b(rm|rmdir|mv|touch|mkdir|chmod|chown|ln)\\s+(-\\S+\\s+)*[^;&|\\n]*${target}`),
      new RegExp(`\\btee\\s+(-a\\s+)?${target}`),
      new RegExp(`\\bsed\\s+-i\\S*\\s+[^;&|\\n]*${target}`),
      new RegExp(`\\bcp\\s+[^;&|\\n]*\\s${target}\\s*($|[;&|\\n])`),     // copy whose destination is inside it
      new RegExp(`\\bcd\\s+${target}\\s*(&&|;)[^\\n]*\\b(git\\s+(add|commit|push|reset|checkout|clean|stash|rebase|merge)|rm|mv|sed\\s+-i|npm|npx|node|tee)\\b`),
    ];
    if (writes.some(r => r.test(cmd))) block('shell write');
    const readOnly = /^\s*(cat|ls|head|tail|grep|rg|find|du|wc|stat|file|git\s+(status|log|show|diff|rev-list))\b/;
    if (cwd.includes(SOURCE) && !readOnly.test(cmd)) block('command run inside it');
    process.exit(0);
  }
  if (/write|replace|append|delete|rename|rewrite|edit|create/i.test(tool)) {
    const paths = [args.path, args.targetFile, args.file_path, args.filePath, args.target].filter(v => typeof v === 'string');
    if (paths.some(p => inSource.test(` ${p}`))) block('file write');
  }
  process.exit(0);
});
