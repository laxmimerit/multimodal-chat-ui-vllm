# Nemotron-3-Nano-Omni vLLM server
# Run: .\serve.ps1

docker run -it `
  --gpus all `
  --ipc=host `
  -p 8000:8000 `
  --shm-size=16g `
  --name vllm-nemotron-omni `
  -v "E:\models\Nemotron-3-Nano-Omni-NVFP4:/model" `
  -v "${PWD}/start.sh:/start.sh" `
  --entrypoint bash `
  vllm/vllm-openai:v0.20.0 `
  /start.sh
