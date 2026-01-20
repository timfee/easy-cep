import { NextResponse } from "next/server";
import { PROVIDERS } from "@/constants";
import { getToken } from "@/lib/auth";
import { runStepWithEvents } from "@/lib/workflow/engine";
import { isStepIdValue } from "@/lib/workflow/step-ids";
import { Var, type WorkflowVars } from "@/lib/workflow/variables";
import type { StepStreamEvent } from "@/types";

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
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

  const writeEvent = async (event: StepStreamEvent) => {
    await writer.write(encoder.encode(toSsePayload(event)));
  };

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
  if (!(googleToken || microsoftToken)) {
    await writeEvent({
      type: "state",
      stepId,
      traceId: "error",
      state: {
        status: "blocked",
        error: "Missing provider tokens",
      },
    });
    await writer.close();
    return new NextResponse(stream.readable, { headers: STREAM_HEADERS });
  }

  vars = {
    ...vars,
    [Var.GoogleAccessToken]: googleToken?.accessToken,
    [Var.MsGraphToken]: microsoftToken?.accessToken,
  };

  try {
    await runStepWithEvents(stepId, vars, writeEvent);
  } catch (error) {
    await writeEvent({
      type: "state",
      stepId,
      traceId: "error",
      state: {
        status: "blocked",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  } finally {
    await writer.close();
  }

  return new NextResponse(stream.readable, { headers: STREAM_HEADERS });
}
