import { NextResponse } from "next/server";

import type { WorkflowVars } from "@/lib/workflow/variables";
import type { StepStreamEvent, StepUIState } from "@/types";

import { PROVIDERS } from "@/constants";
import { getToken } from "@/lib/auth";
import { runStepWithEvents } from "@/lib/workflow/engine";
import { isStepIdValue } from "@/lib/workflow/step-ids";
import { StepStatus } from "@/lib/workflow/step-status";
import { Var } from "@/lib/workflow/variables";

const STREAM_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream",
};

function toSsePayload(event: StepStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const { stepId } = await params;
  if (!isStepIdValue(stepId)) {
    return new NextResponse("Invalid step id", { status: 400 });
  }
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const response = new NextResponse(stream.readable, {
    headers: STREAM_HEADERS,
  });

  let completed = false;
  let latestState: Partial<StepUIState> | undefined;
  let latestVars: Partial<WorkflowVars> = {};
  let lastTraceId: string | undefined;

  const writeEvent = async (event: StepStreamEvent) => {
    lastTraceId = event.traceId;
    if (event.type === "state") {
      latestState = { ...latestState, ...event.state };
    } else if (event.type === "vars") {
      latestVars = { ...latestVars, ...event.vars };
    } else if (event.type === "complete") {
      completed = true;
      latestState = event.state;
      latestVars = { ...latestVars, ...event.newVars };
    }

    try {
      await writer.write(encoder.encode(toSsePayload(event)));
    } catch {
      // Ignore write errors after stream closes.
    }
  };

  const finalizeStream = async () => {
    if (completed) {
      return;
    }
    const fallbackStatus = latestState?.status ?? StepStatus.Blocked;
    const fallbackState: StepUIState = {
      status: fallbackStatus,
      logs: latestState?.logs ?? [],
      error:
        latestState?.error ??
        (fallbackStatus ? undefined : "Step did not complete"),
      notes: latestState?.notes,
      summary: latestState?.summary,
      blockReason: latestState?.blockReason,
      lro: latestState?.lro,
      isChecking: false,
      isExecuting: false,
      isUndoing: latestState?.isUndoing,
    } as StepUIState;
    await writeEvent({
      newVars: latestVars,
      state: fallbackState,
      stepId,
      traceId: lastTraceId ?? "final",
      type: "complete",
    });
  };

  const run = async () => {
    try {
      await writer.write(encoder.encode(":ok\n\n"));

      const { searchParams } = new URL(request.url);
      const varsParam = searchParams.get("vars");
      let vars: Partial<WorkflowVars> = {};
      if (varsParam) {
        try {
          vars = JSON.parse(varsParam) as Partial<WorkflowVars>;
        } catch {
          vars = {};
        }
      }

      const googleToken = await getToken(PROVIDERS.GOOGLE);
      const microsoftToken = await getToken(PROVIDERS.MICROSOFT);

      // We check for tokens but don't hard fail just yet if some steps might not need them?
      // Actually Agent 1 failed hard here. Let's keep the hard fail for safety as most steps need them.
      if (!(googleToken || microsoftToken)) {
        await writeEvent({
          state: {
            error: "Missing provider tokens",
            status: StepStatus.Blocked,
          },
          stepId,
          traceId: "error",
          type: "state",
        });
        return;
        // execution ends, finally block will finalize
      }

      vars = {
        ...vars,
        [Var.GoogleAccessToken]: googleToken?.accessToken,
        [Var.MsGraphToken]: microsoftToken?.accessToken,
      };

      await runStepWithEvents(stepId, vars, writeEvent);
    } catch (error) {
      await writeEvent({
        state: {
          error: error instanceof Error ? error.message : "Unknown error",
          status: StepStatus.Blocked,
        },
        stepId,
        traceId: "error",
        type: "state",
      });
    } finally {
      await finalizeStream();
      await writer.close();
    }
  };

  // Start execution in background
  (async () => {
    try {
      await run();
    } catch (error) {
      console.error("Stream execution failed:", error);
    }
  })();

  return response;
}
