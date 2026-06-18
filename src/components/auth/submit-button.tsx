"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingText: string;
  variant?: ButtonProps["variant"];
};

export function SubmitButton({
  children,
  className,
  pendingText,
  variant,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button className={className ?? "w-full"} disabled={pending} type="submit" variant={variant}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      {pending ? pendingText : children}
    </Button>
  );
}
