"use client";

import type { ComponentProps } from "react";

import {
  Content as CollapsibleContentPrimitive,
  Root as CollapsibleRoot,
  Trigger as CollapsibleTriggerPrimitive,
} from "@radix-ui/react-collapsible";

function Collapsible({ ...props }: ComponentProps<typeof CollapsibleRoot>) {
  return <CollapsibleRoot data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: ComponentProps<typeof CollapsibleTriggerPrimitive>) {
  return (
    <CollapsibleTriggerPrimitive data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  ...props
}: ComponentProps<typeof CollapsibleContentPrimitive>) {
  return (
    <CollapsibleContentPrimitive data-slot="collapsible-content" {...props} />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
