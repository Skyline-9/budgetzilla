# Budgetzilla Documentation Site

This is the documentation site for **Budgetzilla**, a local-first budgeting application.

Built with [Starlight](https://starlight.astro.build/) and [Astro](https://astro.build/).

## 🚀 Project Structure

```
.
├── public/                 # Static assets
├── src/
│   ├── assets/            # Local images/logo
│   ├── content/
│   │   └── docs/          # Markdown documentation files
│   └── styles/            # Custom CSS (Budgetzilla branding)
├── astro.config.mjs        # Astro / Starlight configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## 🧞 Commands

All commands are run from the `docs/` directory:

| Command                   | Action                                           |
| :------------------------ | :---------------- :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build the production site to `./dist/`           |
| `npm run preview`         | Preview your build locally                       |

## 🎨 Theme & Branding

The documentation uses a custom design system mapped to the Budgetzilla webapp:

- **System Autodetection**: Automatically respects the user's OS theme.
- **Theme Toggle**: Accessible in the header for manual dark/light switching.
- **Custom Background**: Implements a rich, radial-glow gradient and grid pattern via `src/styles/custom.css`.

## 🤝 Contributing

Documentation updates are welcome! Please see the [Contributing Guide](https://github.com/your-username/budget/blob/main/docs/src/content/docs/development/contributing.md) for details.
