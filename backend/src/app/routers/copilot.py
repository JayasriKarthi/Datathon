import logging

from fastapi import APIRouter, Depends

from .. import config
from ..auth import Principal, require
from ..schemas import CopilotBody

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("/copilot/query")
def copilot_query(body: CopilotBody, _: Principal = Depends(require("VIEW_AI_SUGGESTIONS"))):
    from .. import agent  # lazy: importing Strands adds ~1s, only pay it when the copilot is used

    history = [m.model_dump() for m in body.history]
    try:
        return {"response": agent.answer(body.query, history), "source": "bedrock"}
    except Exception:
        # Log the reason (missing model access, throttling, ...) but keep the demo alive
        log.exception("Copilot agent failed; using data-backed fallback (model=%s)", config.BEDROCK_MODEL_ID or "unset")
        return {"response": agent.fallback_answer(body.query), "source": "fallback"}
