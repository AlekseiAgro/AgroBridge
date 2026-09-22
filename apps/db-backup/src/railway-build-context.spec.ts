import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const repoRoot = resolve(__dirname, '../../..');
const packageRoot = resolve(__dirname, '..');

describe('Railway db-backup Docker build context', () => {
  const dockerfile = readFileSync(join(packageRoot, 'Dockerfile'), 'utf8');
  const railwayToml = readFileSync(join(packageRoot, 'railway.toml'), 'utf8');

  it('expects repository-root COPY paths that exist only from the repo root', () => {
    expect(dockerfile).toContain('COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./');
    expect(dockerfile).toContain('COPY apps/db-backup/package.json apps/db-backup/package.json');
    expect(dockerfile).toContain('COPY apps/db-backup ./apps/db-backup');

    expect(existsSync(join(repoRoot, 'package.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'pnpm-workspace.yaml'))).toBe(true);
    expect(existsSync(join(repoRoot, 'pnpm-lock.yaml'))).toBe(true);
    expect(existsSync(join(repoRoot, 'apps/db-backup/package.json'))).toBe(true);

    expect(existsSync(join(packageRoot, 'apps/db-backup'))).toBe(false);
    expect(existsSync(join(packageRoot, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('pins Railway to a repo-root Dockerfile path and db-backup watch paths', () => {
    expect(railwayToml).toContain('builder = "DOCKERFILE"');
    expect(railwayToml).toContain('dockerfilePath = "apps/db-backup/Dockerfile"');
    expect(railwayToml).toContain('watchPatterns = ["/apps/db-backup/**"]');
    expect(railwayToml).toContain('startCommand = "node dist/main.js"');
    expect(railwayToml).not.toMatch(/startCommand = "\.\/docker-entrypoint\.sh"/);
    expect(railwayToml).not.toMatch(/cronSchedule/);
  });
});
