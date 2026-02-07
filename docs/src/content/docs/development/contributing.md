---
title: Contributing
description: How to contribute to Budgetzilla.
---

Thank you for your interest in contributing to Budgetzilla! This guide will help you get started.

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR-USERNAME/budget.git
cd budget
```

### 2. Set Up Development Environment

```bash
cd webapp
npm install
npm run dev
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

## Development Guidelines

### Code Style

- **TypeScript** — Use strict types, avoid `any`
- **React** — Functional components with hooks
- **Tailwind** — Use utility classes, avoid custom CSS
- **Formatting** — Run Prettier before committing

### Commit Messages

Use conventional commit format:

```
feat: add budget notifications
fix: correct date parsing in import
docs: update installation guide
refactor: simplify transaction queries
```

### Testing

Run tests before submitting:

```bash
npm run test        # Unit tests
npm run lint        # Linting
npm run typecheck   # Type checking
```

## Types of Contributions

### Bug Fixes

1. Check existing issues for duplicates
2. Create an issue describing the bug
3. Reference the issue in your PR

### New Features

1. Open an issue to discuss the feature first
2. Wait for maintainer feedback
3. Implement once approach is agreed upon

### Documentation

- Fix typos and clarify explanations
- Add examples and use cases
- Translate to other languages

### UI/UX Improvements

- Accessibility enhancements
- Performance optimizations
- Mobile responsiveness

## Pull Request Process

### 1. Before Submitting

- [ ] Tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Types check (`npm run typecheck`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention

### 2. PR Description

Include:
- What changed and why
- Screenshots for UI changes
- Link to related issue

### 3. Review Process

- Maintainers will review within a few days
- Address feedback promptly
- Be open to suggestions

## Project Structure

Key directories for contributors:

```
webapp/src/
├── components/    # UI components (most contributions here)
├── pages/         # Page-level components
├── api/           # Data layer
├── db/            # Database operations
├── hooks/         # Custom React hooks
└── services/      # External integrations
```

## Running the Full Stack

### Browser Development

```bash
cd webapp
npm run dev
```

### macOS App Development

```bash
# Frontend changes only
DEV_MODE=1 ./build_mac_app.sh

# Full rebuild (Swift changes)
./build_mac_app.sh
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Feature Ideas**: Open a GitHub Issue with [Feature] prefix

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow

Thank you for contributing to Budgetzilla!
