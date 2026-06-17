"use client";

import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";

type MetaConnectButtonProps = {
  href: "/api/meta/connect/facebook" | "/api/meta/connect/instagram";
  label: string;
};

export function MetaConnectButton({ href, label }: MetaConnectButtonProps) {
  return (
    <Button
      className="mt-5 w-full"
      onClick={() => window.location.assign(href)}
      type="button"
      variant="outline"
    >
      <Plug className="size-4" />
      {label}
    </Button>
  );
}
