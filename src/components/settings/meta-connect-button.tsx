"use client";

import { useState } from "react";
import { LoaderCircle, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { announceNavigationStart } from "@/components/loading/navigation-progress";

type MetaConnectButtonProps = {
  href: "/api/meta/connect/facebook" | "/api/meta/connect/instagram";
  label: string;
};

export function MetaConnectButton({ href, label }: MetaConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  return (
    <Button
      className="mt-5 w-full"
      disabled={isConnecting}
      onClick={() => {
        setIsConnecting(true);
        announceNavigationStart();
        window.location.assign(href);
      }}
      type="button"
      variant="outline"
    >
      {isConnecting ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Plug className="size-4" />
      )}
      {isConnecting ? "Connecting..." : label}
    </Button>
  );
}
