# Multimodal Chat UI — vLLM

A Next.js chat interface for any multimodal model served via vLLM.  
Supports text, image, audio, video, drag-and-drop, voice recording, and thinking mode.

---

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with GPU support enabled)
- [Node.js 18+](https://nodejs.org/)
- [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli)
- NVIDIA GPU with enough VRAM for your chosen model

---

## Step 1 — Download a Model

Install the HF CLI:
```bash
pip install -U "huggingface_hub[hf_xet]"
hf auth login
```

Download any supported model to a local directory:
```bash
# Example: Nemotron Omni NVFP4 (~21 GB)
huggingface-cli download nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4 \
  --local-dir E:\models\Nemotron-3-Nano-Omni-NVFP4 --max-workers 8

# Example: Gemma 4 (adjust model ID and path)
huggingface-cli download google/gemma-3-27b-it \
  --local-dir E:\models\gemma-3-27b-it --max-workers 8
```

---

## Step 2 — Configure the Server

Edit `start.sh` and set the flags for your model:

```bash
vllm serve /model \
  --served-model-name your-model-name \
  --host 0.0.0.0 \
  --trust-remote-code \
  --max-model-len 32768 \
  --max-num-seqs 64
  # add --reasoning-parser / --tool-call-parser as needed
```

Edit `serve.ps1` and point the volume mount to your model folder:

```powershell
-v "E:\models\YourModelFolder:/model" `
```

---

## Step 3 — Start the vLLM Server

```powershell
# First run (creates container)
.\serve.ps1

# Subsequent runs (reuses existing container — faster)
docker start -i vllm-nemotron-omni
```

Wait for:
```
INFO: Application startup complete.
```

---

## Step 4 — Start the Chat UI

```bash
cd chat-ui
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Step 5 — Configure the UI Model Name

Edit `chat-ui/.env.local`:
```env
VLLM_URL=http://localhost:8000
MODEL=your-model-name   # must match --served-model-name in start.sh
```

---

## Supported Inputs

| Type | Format |
|------|--------|
| Text | Any |
| Image | JPEG, PNG, WebP |
| Audio | WAV, MP3, WebM |
| Video | MP4 |
| Voice | Record directly in browser |

---

## Tested Models

| Model | Variant | VRAM |
|-------|---------|------|
| nvidia/Nemotron-3-Nano-Omni-30B-A3B | NVFP4 | ~22 GB |
