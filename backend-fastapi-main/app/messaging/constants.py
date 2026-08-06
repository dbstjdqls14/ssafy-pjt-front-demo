APP_ID = "aivo-ai-server"

EXCHANGE_TYPE = "direct"

ANALYSIS_EXCHANGE = "analysis.exchange"

LLM_QUEUE = "analysis.llm.queue"
AUDIO_QUEUE = "analysis.audio.queue"
RESULT_QUEUE = "analysis.result.queue"

LLM_RETRY_QUEUE = "analysis.llm.retry.queue"
AUDIO_RETRY_QUEUE = "analysis.audio.retry.queue"
RESULT_RETRY_QUEUE = "analysis.result.retry.queue"

DEAD_QUEUE = "analysis.dead.queue"

LLM_ROUTING_KEY = "analysis.request.llm"
AUDIO_ROUTING_KEY = "analysis.request.audio"
RESULT_ROUTING_KEY = "analysis.result"

LLM_RETRY_ROUTING_KEY = "analysis.retry.llm"
AUDIO_RETRY_ROUTING_KEY = "analysis.retry.audio"
RESULT_RETRY_ROUTING_KEY = "analysis.retry.result"

DEAD_ROUTING_KEY = "analysis.dead"
