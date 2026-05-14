import { ipcMain } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface DvResult {
    ok: boolean;
    stdout: string;
    stderr: string;
    code: number | null;
}

// Cache the resolved `dv` binary path so we don't hit the filesystem every call.
let resolvedDvPath: string | null = null;

function commonInstallCandidates(): string[] {
    const candidates: string[] = [];
    if (process.platform === 'win32') {
        const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
        const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
        candidates.push(
            path.join(localApp, 'Programs', 'Diversion', 'dv.exe'),
            path.join(localApp, 'Diversion', 'dv.exe'),
            path.join(programFiles, 'Diversion', 'dv.exe'),
            path.join(programFilesX86, 'Diversion', 'dv.exe'),
            path.join(os.homedir(), '.diversion', 'bin', 'dv.exe'),
        );
    } else {
        candidates.push(
            '/usr/local/bin/dv',
            '/opt/diversion/bin/dv',
            path.join(os.homedir(), '.diversion', 'bin', 'dv'),
        );
    }
    return candidates;
}

// Use `where`/`which` to locate dv via the system PATH.
function findOnPath(): Promise<string | null> {
    return new Promise((resolve) => {
        const cmd = process.platform === 'win32' ? 'where' : 'which';
        const child = spawn(cmd, ['dv'], { windowsHide: true });
        let out = '';
        child.stdout.on('data', (d) => { out += d.toString(); });
        child.on('error', () => resolve(null));
        child.on('close', (code) => {
            if (code !== 0) return resolve(null);
            const first = out.split(/\r?\n/).map(s => s.trim()).find(Boolean);
            resolve(first || null);
        });
    });
}

async function resolveDvPath(force = false): Promise<string | null> {
    if (!force && resolvedDvPath) return resolvedDvPath;

    const onPath = await findOnPath();
    if (onPath && existsSync(onPath)) {
        resolvedDvPath = onPath;
        return resolvedDvPath;
    }

    for (const candidate of commonInstallCandidates()) {
        if (existsSync(candidate)) {
            resolvedDvPath = candidate;
            return resolvedDvPath;
        }
    }

    resolvedDvPath = null;
    return null;
}

function runDv(args: string[], cwd?: string, timeoutMs: number = 30000): Promise<DvResult> {
    return new Promise(async (resolve) => {
        const dvPath = await resolveDvPath();
        // If we know an absolute path, call it directly. Otherwise fall back to
        // `shell: true` so the OS shell resolves `.cmd`/`.bat` on Windows and
        // picks up the user's current PATH (helps when dv was installed after
        // the app started but is now reachable through a wrapper).
        const exe = dvPath || 'dv';
        const useShell = !dvPath;
        execFile(exe, args, {
            cwd,
            windowsHide: true,
            shell: useShell,
            maxBuffer: 16 * 1024 * 1024,
            timeout: timeoutMs,
        }, (err, stdout, stderr) => {
            const code = err ? (typeof (err as any).code === 'number' ? (err as any).code : null) : 0;
            resolve({
                ok: !err,
                stdout: stdout?.toString() || '',
                stderr: stderr?.toString() || (err?.message || ''),
                code,
            });
        });
    });
}

// Project path may be either the .uproject file or its parent directory.
function projectDir(projectPath: string): string {
    if (!projectPath) return '';
    try {
        if (existsSync(projectPath) && statSync(projectPath).isDirectory()) return projectPath;
    } catch { /* ignore */ }
    return path.dirname(projectPath);
}

export type ChangeKind = 'new' | 'modified' | 'deleted';

export interface ParsedStatus {
    counts: { new: number; modified: number; deleted: number };
    files: { path: string; kind: ChangeKind }[];
}

function classifyLine(line: string): { kind: ChangeKind; path: string } | null {
    // "New file:    path", "new:    path", "?? path"
    let m = line.match(/^(?:new\s*file|new|added|untracked)[\s:]+(.+)$/i);
    if (m) return { kind: 'new', path: m[1].trim() };
    m = line.match(/^\?\?\s+(.+)$/);
    if (m) return { kind: 'new', path: m[1].trim() };

    // "Modified: path", "M  path"
    m = line.match(/^modified[\s:]+(.+)$/i);
    if (m) return { kind: 'modified', path: m[1].trim() };
    m = line.match(/^M\s+(.+)$/);
    if (m) return { kind: 'modified', path: m[1].trim() };

    // "Deleted: path", "D path"
    m = line.match(/^deleted[\s:]+(.+)$/i);
    if (m) return { kind: 'deleted', path: m[1].trim() };
    m = line.match(/^D\s+(.+)$/);
    if (m) return { kind: 'deleted', path: m[1].trim() };

    return null;
}

function parseStatus(statusText: string): ParsedStatus {
    const counts = { new: 0, modified: 0, deleted: 0 };
    const files: { path: string; kind: ChangeKind }[] = [];

    // Track header-section context so we can attach bare path lines to the
    // right category if the CLI lists each file under a section header.
    let currentSection: ChangeKind | null = null;

    for (const raw of statusText.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;

        // Section headers: "New files:", "Modified files:", "Deleted files:"
        const sectionMatch = line.match(/^(new\s*files?|modified\s*files?|deleted\s*files?)\s*[:\-]?\s*(\d+)?\s*$/i);
        if (sectionMatch) {
            const head = sectionMatch[1].toLowerCase();
            const count = sectionMatch[2] ? parseInt(sectionMatch[2], 10) : NaN;
            if (head.startsWith('new')) {
                currentSection = 'new';
                if (!isNaN(count)) counts.new = Math.max(counts.new, count);
            } else if (head.startsWith('modified')) {
                currentSection = 'modified';
                if (!isNaN(count)) counts.modified = Math.max(counts.modified, count);
            } else {
                currentSection = 'deleted';
                if (!isNaN(count)) counts.deleted = Math.max(counts.deleted, count);
            }
            continue;
        }

        // Inline-classified line ("M path", "new file: path", etc.)
        const cls = classifyLine(line);
        if (cls && cls.path) {
            files.push(cls);
            counts[cls.kind] += 1;
            continue;
        }

        // Bare path under the current section context.
        if (currentSection && !line.endsWith(':') && /[\\/.]/.test(line)) {
            files.push({ kind: currentSection, path: line });
            counts[currentSection] += 1;
        }
    }

    return { counts, files };
}

interface ParsedCommit {
    id?: string;
    message?: string;
    author?: string;
    date?: string;
    branch?: string;
}

function parseTextLog(text: string): ParsedCommit[] {
    const commits: ParsedCommit[] = [];
    // Split on commit headers; "commit <hash>" or "Commit: <id>".
    const blocks = text.split(/\n(?=commit[:\s])/i);
    for (const block of blocks) {
        const idMatch = block.match(/commit[:\s]+([A-Za-z0-9._-]+)/i);
        const authorMatch = block.match(/^author[:\s]+(.+)$/im);
        const dateMatch = block.match(/^date[:\s]+(.+)$/im);
        // Message: take the first non-header, non-empty block of indented lines.
        const lines = block.split(/\r?\n/);
        const msgLines: string[] = [];
        let inMsg = false;
        for (const raw of lines) {
            if (!inMsg) {
                if (/^(commit[:\s]|author[:\s]|date[:\s])/i.test(raw)) continue;
                if (raw.trim() === '') { inMsg = true; continue; }
            }
            if (inMsg) {
                if (raw.trim() === '') break;
                msgLines.push(raw.trim());
            }
        }
        const id = idMatch?.[1];
        const message = msgLines.join(' ').trim();
        if (id || message) {
            commits.push({
                id,
                message: message || undefined,
                author: authorMatch?.[1]?.trim(),
                date: dateMatch?.[1]?.trim(),
            });
        }
    }
    return commits;
}

function tryParseJsonLog(stdout: string): ParsedCommit[] | null {
    const trimmed = stdout.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
    try {
        const data = JSON.parse(trimmed);
        const arr = Array.isArray(data) ? data : (data.commits || data.items || []);
        if (!Array.isArray(arr)) return null;
        return arr.map((c: any): ParsedCommit => ({
            id: c.id || c.commit_id || c.hash || c.sha,
            message: c.message || c.subject,
            author: c.author || c.author_name || c.user,
            date: c.date || c.timestamp || c.committed_at,
            branch: c.branch,
        }));
    } catch {
        return null;
    }
}

export function registerDiversionHandlers() {
    // ── CLI availability ────────────────────────────────────────────
    ipcMain.handle('diversion-check-cli', async () => {
        // Re-resolve every time the user explicitly re-checks, in case dv was
        // just installed.
        const dvPath = await resolveDvPath(true);

        // Try a couple of variants — different versions of dv may use either.
        let res = await runDv(['--version']);
        if (!res.ok) res = await runDv(['version']);

        if (res.ok) {
            return {
                available: true,
                version: res.stdout.trim() || res.stderr.trim(),
                path: dvPath || undefined,
            };
        }

        const candidates = commonInstallCandidates();
        return {
            available: false,
            error: res.stderr.trim() || `dv not found on PATH or in standard locations`,
            searchedPath: dvPath || undefined,
            searchedCandidates: candidates,
        };
    });

    // ── Repo detection ──────────────────────────────────────────────
    ipcMain.handle('diversion-check-repo', async (_evt, projectPath: string) => {
        const cwd = projectDir(projectPath);
        if (!cwd) return false;
        // `dv status` exits non-zero outside a Diversion workspace.
        const res = await runDv(['status'], cwd, 10000);
        return res.ok;
    });

    // ── Workspace status ────────────────────────────────────────────
    ipcMain.handle('diversion-get-status', async (_evt, projectPath: string) => {
        const cwd = projectDir(projectPath);
        if (!cwd) return { error: 'no_project', counts: null, files: [], raw: '' };
        const res = await runDv(['status'], cwd);
        if (!res.ok) {
            return {
                error: res.stderr.trim() || `dv status exited with code ${res.code}`,
                counts: null,
                files: [],
                raw: res.stdout,
            };
        }
        const parsed = parseStatus(res.stdout);
        return { error: null, counts: parsed.counts, files: parsed.files, raw: res.stdout };
    });

    // ── Commit ──────────────────────────────────────────────────────
    ipcMain.handle('diversion-commit', async (_evt, projectPath: string, message: string) => {
        const cwd = projectDir(projectPath);
        if (!cwd) return { success: false, error: 'no_project' };
        const trimmed = (message || '').trim();
        if (!trimmed) return { success: false, error: 'empty_message' };

        // Try `dv commit -a -m "msg"` (auto-stage all changes). If the flag is
        // not supported, fall back to `dv add . && dv commit -m "msg"`.
        let res = await runDv(['commit', '-a', '-m', trimmed], cwd, 120000);
        if (!res.ok) {
            const addRes = await runDv(['add', '.'], cwd, 60000);
            if (!addRes.ok) {
                return {
                    success: false,
                    error: addRes.stderr.trim() || `dv add exited with code ${addRes.code}`,
                    raw: addRes.stdout,
                };
            }
            res = await runDv(['commit', '-m', trimmed], cwd, 120000);
        }
        if (!res.ok) {
            return {
                success: false,
                error: res.stderr.trim() || `dv commit exited with code ${res.code}`,
                raw: res.stdout,
            };
        }
        return { success: true, raw: res.stdout };
    });

    // ── Commit history ──────────────────────────────────────────────
    ipcMain.handle('diversion-get-history', async (_evt, projectPath: string, limit: number = 100) => {
        const cwd = projectDir(projectPath);
        if (!cwd) return { error: 'no_project', commits: [], raw: '' };

        // Prefer structured output if the CLI supports it.
        const jsonRes = await runDv(['log', '--json', '-n', String(limit)], cwd);
        if (jsonRes.ok) {
            const parsed = tryParseJsonLog(jsonRes.stdout);
            if (parsed) return { error: null, commits: parsed, raw: jsonRes.stdout };
        }

        const textRes = await runDv(['log', '-n', String(limit)], cwd);
        if (!textRes.ok) {
            // Try without -n in case the flag is unsupported.
            const fallback = await runDv(['log'], cwd);
            if (!fallback.ok) {
                return {
                    error: fallback.stderr.trim() || textRes.stderr.trim() || `dv log exited with code ${textRes.code}`,
                    commits: [],
                    raw: fallback.stdout || textRes.stdout || '',
                };
            }
            return { error: null, commits: parseTextLog(fallback.stdout), raw: fallback.stdout };
        }
        return { error: null, commits: parseTextLog(textRes.stdout), raw: textRes.stdout };
    });

    // ── Branch checkout ─────────────────────────────────────────────
    ipcMain.handle('diversion-checkout-branch', async (_evt, projectPath: string, branchName: string) => {
        const cwd = projectDir(projectPath);
        if (!cwd) return { success: false, error: 'no_project' };
        if (!branchName) return { success: false, error: 'empty_branch' };

        // Diversion CLI doesn't publicly document a branch-switch command, so
        // we try every plausible variant we've seen across docs/blog posts.
        const attempts: string[][] = [
            ['checkout', branchName],
            ['co', branchName],
            ['switch', branchName],
            ['branch', '-co', branchName],
            ['branch', '-s', branchName],
            ['branch', '--checkout', branchName],
        ];
        const tried: { cmd: string; stderr: string }[] = [];
        for (const args of attempts) {
            const res = await runDv(args, cwd, 120000);
            if (res.ok) return { success: true, raw: res.stdout, cmd: `dv ${args.join(' ')}` };
            // Capture useful output only — skip Node's "Command failed" prefix.
            let err = res.stderr.trim();
            if (!err || err.startsWith('Command failed:')) err = res.stdout.trim();
            tried.push({ cmd: `dv ${args.join(' ')}`, stderr: err });
        }
        const summary = tried
            .map(t => `${t.cmd}\n${t.stderr || '(no output)'}`)
            .join('\n\n---\n\n');
        return {
            success: false,
            error: `No 'dv' branch-switch variant succeeded. Tried:\n\n${summary}`,
        };
    });

    // ── Branches ────────────────────────────────────────────────────
    ipcMain.handle('diversion-get-branches', async (_evt, projectPath: string) => {
        const cwd = projectDir(projectPath);
        if (!cwd) return { error: 'no_project', branches: [], current: '' };
        const res = await runDv(['branch'], cwd);
        if (!res.ok) {
            return {
                error: res.stderr.trim() || `dv branch exited with code ${res.code}`,
                branches: [],
                current: '',
            };
        }
        const branches: string[] = [];
        let current = '';
        for (const raw of res.stdout.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            if (line.startsWith('*')) {
                const name = line.slice(1).trim();
                branches.push(name);
                current = name;
            } else {
                branches.push(line);
            }
        }
        return { error: null, branches, current };
    });
}
