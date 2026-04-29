# Generic vLLM server launcher
# Usage: .\serve.ps1 -Script models/start_nemotron_omni.sh -Model E:\models\Nemotron-3-Nano-Omni-NVFP4 -Name vllm-nemotron-omni

param(
    [string]$Script = "models/start_nemotron_omni.sh",
    [string]$Model  = "E:\models\Nemotron-3-Nano-Omni-NVFP4",
    [string]$Name   = "vllm-server"
)

docker run -it `
  --gpus all `
  --ipc=host `
  -p 8000:8000 `
  --shm-size=16g `
  --name $Name `
  -v "${Model}:/model" `
  -v "${PWD}/${Script}:/start.sh" `
  --entrypoint bash `
  vllm/vllm-openai:v0.20.0 `
  /start.sh
