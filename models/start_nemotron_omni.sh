#!/bin/bash
pip install -q 'vllm[audio]'
vllm serve /model \
  --host 0.0.0.0 \
  --trust-remote-code \
  --max-model-len 131072 \
  --max-num-seqs 64 \
  --kv-cache-dtype fp8 \
  --video-pruning-rate 0.5 \
  --allowed-local-media-path / \
  --media-io-kwargs '{"video": {"fps": 2, "num_frames": 256}}' \
  --reasoning-parser nemotron_v3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder
