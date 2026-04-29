#!/bin/bash
vllm serve /model \
  --served-model-name google/gemma-3-27b-it \
  --host 0.0.0.0 \
  --trust-remote-code \
  --max-model-len 32768 \
  --max-num-seqs 64
