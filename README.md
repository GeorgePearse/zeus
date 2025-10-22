<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">The AI coding agent built for the terminal.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/sst/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/sst/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package managers
npm i -g opencode-ai@latest        # or bun/pnpm/yarn
brew install sst/tap/opencode      # macOS and Linux
paru -S opencode-bin               # Arch Linux
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$OPENCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if exists or can be created)
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Documentation

For more info on how to configure OpenCode [**head over to our docs**](https://opencode.ai/docs).

### OptiLLM Integration

OptiLLM is now available as a built-in provider for richer reasoning workflows.

```bash
# Install and start the proxy
pip install optillm
OPENAI_API_KEY="sk-your-upstream-key" optillm
```

By default OpenCode connects to `http://127.0.0.1:8000/v1`. Override this or secure the proxy with:

- `OPTILLM_BASE_URL` – custom OptiLLM endpoint
- `OPTILLM_API_KEY` – shared secret required by the proxy
- `OPTILLM_APPROACH` – force a specific approach such as `moa`, `plansearch`, or `mars`

Pick any OptiLLM strategy model from the palette (for example `optillm/moa-gpt-4o-mini`). To make it the default, drop this in `opencode.jsonc`:

```jsonc
{
  "model": "optillm/moa-gpt-4o-mini"
}
```

OptiLLM inherits all upstream model capabilities and supports logprob-aware decoding strategies exposed via `extra_body`.

### Contributing

OpenCode is an opinionated tool so any fundamental feature needs to go through a
design process with the core team.

> [!IMPORTANT]
> We do not accept PRs for core features.

However we still merge a ton of PRs - you can contribute:

- Bug fixes
- Improvements to LLM performance
- Support for new providers
- Fixes for env specific quirks
- Missing standard behavior
- Documentation

Take a look at the git history to see what kind of PRs we end up merging.

> [!NOTE]
> If you do not follow the above guidelines we might close your PR.

To run OpenCode locally you need.

- Bun 1.3 or higher
- Golang 1.24.x

And run.

```bash
$ bun install
$ bun dev
```

#### Python Development Setup

For Python tooling and scripts, we use `uv` for package management with `prek` and `zuban`:

```bash
# Create virtual environment
uv venv --python 3.11

# Install dependencies
source .venv/bin/activate
uv pip install prek zuban

# Install prek hooks (faster Rust-based pre-commit)
prek install

# Run type checking with zuban (20-200x faster than mypy)
zuban check
```

**Tools:**
- **prek**: Fast, Rust-based alternative to pre-commit (drop-in replacement)
- **zuban**: High-performance Python type checker (20-200x faster than mypy)
- Configuration in `pyproject.toml` and `.pre-commit-config.yaml`

#### Development Notes

**API Client**: After making changes to the TypeScript API endpoints in `packages/opencode/src/server/server.ts`, you will need the OpenCode team to generate a new stainless sdk for the clients.

### FAQ

#### How is this different than Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although Anthropic is recommended, OpenCode can be used with OpenAI, Google or even local models. As models evolve the gaps between them will close and pricing will drop so being provider-agnostic is important.
- Out of the box LSP support
- A focus on TUI. OpenCode is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This for example can allow OpenCode to run on your computer, while you can drive it remotely from a mobile app. Meaning that the TUI frontend is just one of the possible clients.

#### What's the other repo?

The other confusingly named repo has no relation to this one. You can [read the story behind it here](https://x.com/thdxr/status/1933561254481666466).

### Future Integrations

Projects and tools we're considering for future integration:

- **[trae-agent](https://github.com/bytedance/trae-agent)** - ByteDance's agent framework
- **[OptiLLM](https://github.com/codelion/optillm)** - Further integration beyond current proxy support
- **[Genesis](https://github.com/GeorgePearse/Genesis)** - To be evaluated

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
