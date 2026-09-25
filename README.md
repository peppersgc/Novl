# Novl

A local, offline AI writing app: your project documents on the left, an AI prompt box on top, and a full markdown text editor below. Everything runs on your machine — no accounts, no cloud, no telemetry.

Novl is **designed for midgrade integrated graphics**, the kind found in mini PCs and laptops. It has no heavy GPU requirements and runs comfortably on CPU alone.

> Developed and tested on **AMD Ryzen with no discrete graphics card** (integrated Radeon only).

## Features

- **Projects & documents** — organize your writing into projects, categories, and chapters stored in plain files.
- **Local AI assistant** — generate and rewrite text through a bundled `llama-server` binary; prompts, reference docs, and persona instructions are all composed locally.
- **Markdown editor** — full editor with formatting built in.
- **Find tool** — in-editor find with highlighted matches.
- **Bring your own model** — point Novl at any GGUF model in the settings window; no lock-in to a hosted service.
- **Portable** — the Windows build is fully self-contained (`win-unpacked`); no installer required.

## Requirements

- **OS:** Windows 10/11 (x64)
- **RAM:** 8 GB minimum, 16 GB recommended (the bundled 9B Q4 model uses ~10 GB when generating)
- **GPU:** none required — CPU inference (see compatibility note below)
- **Disc space:** ~1.5 GB for the app plus model files

### Hardware compatibility

The bundled inference backend is tuned for **AMD Ryzen CPUs (Zen 4 / AVX-512)** and runs on CPU only.

- ✅ Works: AMD Ryzen and most modern Intel/AMD laptops and mini PCs, even with integrated graphics only
- ⚠️ Not tested / not required: discrete GPUs, NVIDIA CUDA, AMD Vulkan — the app does not depend on them
- ℹ️ On small RAM (8 GB) use a 1–3B parameter model to avoid heavy swap

## Getting started

1. Download the latest release (`novl-<version>-win32-x64.zip`).
2. Unzip anywhere and run `novl.exe`.
3. Open **Settings** and pick a GGUF model file (e.g. a Qwen 3.5 1B/9B Q4 quant). The recommended tested model is a 9B Q4_K_M quant running in ~16–100 s per generation on a Ryzen 7 7840HS.
4. Create a project, add a document, and start writing. Use the AI box to ask for continuations, rewrites, or outline help.

Models are kept in plain `.gguf` files; any GGUF that works with `llama.cpp` should work here.

## Building from source

```bash
npm install
npm run typecheck
npm run build
```

The app expects a `llama-server` binary at runtime:

- **Dev:** place `llama-server.exe` (+ DLLs) in `backend/`.
- **Packaged:** binaries are copied to `resources/llama-server/` during the release build.

## Project layout

```text
src/
  main/        Electron main process (IPC, project files, llama-server client)
  preload/     Renderer bridge
  renderer/    React UI (editor, project sidebar, AI panel, settings)
  shared/      Types shared between processes
backend/       llama-server runtime binaries (dev), bundled into releases
```

## Release builds

```text
dist/win-unpacked/   Fully self-contained portable app (what you ship as a zip)
```

## Acknowledgments

- **[Recall](https://github.com/raiyanyahya/recall)** by **Raiyan Yahya** — its token-free local summarizer (TF-IDF + TextRank) was ported and used to condense reference documents into a compact context before each generation.
- **ik_llama.cpp ([ikawrakow](https://github.com/ikawrakow/ik_llama.cpp), build 5311, commit `01165d82`, Clang 19.1.5)** — the CPU inference backend Novl uses to power offline generation on Zen 4 / AVX-512 hardware.

## License

MIT — see [LICENSE](LICENSE).