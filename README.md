<p align="center">
  <a href="https://zeus.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="⚡ Zeus logo">
    </picture>
  </a>
</p>
<p align="center">⚡ Zeus - The AI coding agent built for the terminal.</p>
<p align="center">
  <a href="https://zeus.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/zeus-ai"><img alt="npm" src="https://img.shields.io/npm/v/zeus-ai?style=flat-square" /></a>
  <a href="https://github.com/sst/zeus/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/sst/zeus/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![⚡ Zeus Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://zeus.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://zeus.ai/install | bash

# Package managers
npm i -g zeus-ai@latest        # or bun/pnpm/yarn
brew install sst/tap/zeus      # macOS and Linux
paru -S zeus-bin               # Arch Linux
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$ZEUS_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if exists or can be created)
4. `$HOME/.zeus/bin` - Default fallback

```bash
# Examples
ZEUS_INSTALL_DIR=/usr/local/bin curl -fsSL https://zeus.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://zeus.ai/install | bash
```

### Documentation

For more info on how to configure ⚡ Zeus [**head over to our docs**](https://zeus.ai/docs).

### OptiLLM Integration

OptiLLM is now available as a built-in provider for richer reasoning workflows.

```bash
# Install and start the proxy
pip install optillm
OPENAI_API_KEY="sk-your-upstream-key" optillm
```

By default ⚡ Zeus connects to `http://127.0.0.1:8000/v1`. Override this or secure the proxy with:

- `OPTILLM_BASE_URL` – custom OptiLLM endpoint
- `OPTILLM_API_KEY` – shared secret required by the proxy
- `OPTILLM_APPROACH` – force a specific approach such as `moa`, `plansearch`, or `mars`

Pick any OptiLLM strategy model from the palette (for example `optillm/moa-gpt-4o-mini`). To make it the default, drop this in `zeus.jsonc`:

```jsonc
{
  "model": "optillm/moa-gpt-4o-mini"
}
```

OptiLLM inherits all upstream model capabilities and supports logprob-aware decoding strategies exposed via `extra_body`.

### Contributing

⚡ Zeus is an opinionated tool so any fundamental feature needs to go through a
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

To run ⚡ Zeus locally you need.

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

**API Client**: After making changes to the TypeScript API endpoints in `packages/zeus/src/server/server.ts`, you will need the ⚡ Zeus team to generate a new stainless sdk for the clients.

### FAQ

#### How is ⚡ Zeus different than Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although Anthropic is recommended, ⚡ Zeus can be used with OpenAI, Google or even local models. As models evolve the gaps between them will close and pricing will drop so being provider-agnostic is important.
- Out of the box LSP support
- A focus on TUI. ⚡ Zeus is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This for example can allow ⚡ Zeus to run on your computer, while you can drive it remotely from a mobile app. Meaning that the TUI frontend is just one of the possible clients.

#### What's the other repo?

The other confusingly named repo has no relation to this one. You can [read the story behind it here](https://x.com/thdxr/status/1933561254481666466).

### Future Integrations

Projects and tools we're considering for future integration:

#### **[trae-agent](https://github.com/bytedance/trae-agent)** - Research-First Agent Framework
ByteDance's intelligent software engineering assistant designed specifically for AI agent research and experimentation.

**Key Features:**
- **Rich Tool Ecosystem**: Comprehensive file manipulation, shell execution, and structured reasoning capabilities
- **Trajectory Logging**: Detailed execution logs for auditing and analyzing agent decision-making processes
- **Multi-Provider Support**: Works with OpenAI, Anthropic, Google Gemini, Ollama, and other LLM providers
- **Lakeview Summarization**: Distills agent reasoning steps into concise explanations, improving interpretability
- **Research-Centric Design**: Built as a platform for studying agent architectures and conducting ablation studies

**Potential Integration**: Could enhance ⚡ Zeus's research capabilities and provide deeper insights into agent reasoning patterns, especially valuable for understanding how different LLMs approach coding tasks.

#### **[OptiLLM](https://github.com/codelion/optillm)** - Advanced Reasoning Strategies
Currently integrated as an external proxy, but deeper integration possibilities exist.

**Current Integration:**
- External proxy server supporting mixture of agents (MoA), planning search, MARS, and other strategies
- Configured via environment variables (OPTILLM_BASE_URL, OPTILLM_API_KEY, OPTILLM_APPROACH)
- Available as built-in provider with models like `optillm/moa-gpt-4o-mini`

**Future Integration Possibilities:**
- **Native Strategy Support**: Embed OptiLLM reasoning strategies directly into ⚡ Zeus without external proxy
- **Automatic Strategy Selection**: Intelligently choose reasoning approach based on task complexity
- **Hybrid Workflows**: Combine multiple strategies for different stages of coding tasks
- **Performance Optimization**: Reduce latency by eliminating proxy overhead
- **Custom Strategy Development**: Build ⚡ Zeus-specific reasoning patterns optimized for terminal-based workflows

**Benefits**: Would enable more sophisticated problem-solving approaches, particularly for complex refactoring, architectural decisions, and multi-file changes.

#### **[Genesis](https://github.com/GeorgePearse/Genesis)** - LLM-Driven Code Evolution
An experimental framework combining Large Language Models with evolutionary algorithms for automated code optimization.

**Core Capabilities:**
- **Evolutionary Programming**: Maintains populations of code that evolve over generations
- **LLM-Powered Mutations**: Uses ensemble of LLMs as intelligent mutation operators
- **Parallel Evaluation**: Scales across local machines, Slurm clusters, or cloud sandboxes
- **Knowledge Transfer**: Archive-based learning between evolutionary islands
- **Interactive Monitoring**: Real-time WebUI with genealogy trees and performance metrics
- **Flexible Deployment**: Supports local execution, Docker, and Conda environments

**Use Cases:**
- Automated performance optimization of generated code
- Exploration of alternative implementation strategies
- Scientific code discovery with verifiable metrics
- Systematic improvement of recurring code patterns

**Potential Integration**: Could enable ⚡ Zeus to automatically optimize code it generates, explore multiple solution approaches in parallel, and learn from evolutionary feedback to improve future code generation. Particularly valuable for performance-critical code and algorithmic problems where multiple valid approaches exist.

**Evaluation Status**: Experimental - assessing how evolutionary approaches could complement traditional LLM code generation workflows.

---

**Join our community** [Discord](https://discord.gg/zeus) | [X.com](https://x.com/zeus)
