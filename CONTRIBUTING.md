# Contributing & Engineering Standards

Thank you for contributing to the **Distributed Job Scheduler Platform**. To ensure high code quality, scalability, maintainability, and clear audit trails, all contributions must follow the guidelines detailed below.

---

## 1. Branch Naming Conventions

Branches should follow a structured prefixing format based on the scope of work:

- `feat/<feature-name>`: A new feature or capability (e.g., `feat/atomic-worker-claim`, `feat/dlq-management`)
- `fix/<bug-name>`: A bug fix or patch (e.g., `fix/heartbeat-reaper-race-condition`)
- `refactor/<scope>`: Code refactoring without behavioral changes (e.g., `refactor/zod-validation-pipeline`)
- `perf/<scope>`: Performance optimizations (e.g., `perf/skip-locked-indexes`)
- `test/<scope>`: Adding or fixing test suites (e.g., `test/concurrency-race-stress`)
- `docs/<scope>`: Documentation updates (e.g., `docs/er-diagram-updates`)
- `chore/<scope>`: Build tools, dependencies, or configuration changes (e.g., `chore/setup-monorepo`)

---

## 2. Commit Message Format (Conventional Commits)

All commit messages must strictly adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <short description in present tense>

[optional body providing technical context and rationale]

[optional footer(s) e.g., Closes #123]
```

### Allowed Types:
- `feat`: A new user-facing or system feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Formatting, missing semicolons, etc. (no production code change)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build process, auxiliary tools, or libraries

### Examples:
- `feat(worker): implement atomic job claiming with SELECT FOR UPDATE SKIP LOCKED`
- `fix(scheduler): handle dead worker reaper timeout threshold edge case`
- `docs(architecture): add complete 14-table ER diagram and indexing notes`

---

## 3. Code Standards & Architecture Guidelines

1. **Separation of Concerns**:
   - Backend APIs (`/backend`): Controllers -> Services -> Repositories -> Database.
   - Worker Fleet (`/worker`): Independent polling loops, concurrency slots, heartbeat daemon.
   - Shared Types (`/shared`): Shared TypeScript interfaces, DTOs, and Zod schemas.
2. **Type Safety**:
   - No `any` types in production code. Always define strict TypeScript interfaces and DTOs.
3. **Database Integrity**:
   - Always define explicit foreign keys, indexes for queried fields, and cascade rules.
   - Use atomic transactions when claiming or mutating job states.
4. **Error Handling**:
   - Return structured error responses: `{ success: false, error: { code: string, message: string, details?: any } }`.
